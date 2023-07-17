import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";

// Get registry info (creds and endpoint).
const registryInfo = aws.ecr
  .getAuthorizationToken({})
  .then(registry => {
    const decoded = Buffer.from(registry.authorizationToken, "base64")
      .toString()
      .split(":");
    return {
      server: registry.proxyEndpoint, // Server is the endpoint
      username: decoded[0], // Username is the first part of the decoded string
      password: decoded[1], // Password is the second part of the decoded string
    };
  });

// Create a private ECR repository for web image.
const webRepo = new aws.ecr.Repository("web-repo");

// Create a private ECR repository for API image.
const apiRepo = new aws.ecr.Repository("api-repo");

// Build and publish the Docker image to the ECR repository.
function buildAndPushImage(
  repo: aws.ecr.Repository,
  appName: string,
  imageName: pulumi.Input<string>
): pulumi.Output<string> {
  // Docker build context
  const context = `../${appName}`;

  // Dockerfile path
  const dockerfilePath = `${context}/Dockerfile`;

  // Create a Docker image from our sample application.
  const image = new docker.Image(
    `${repo.id}-image-${Date.now()}`,
    {
      build: {
        context: context,
        dockerfile: dockerfilePath,
      },
      imageName: pulumi.interpolate`prefix${imageName}suffix`,
      registry: registryInfo,
    }
  );

  return image.imageName;
}

// Get Docker images.
const webImageName = "073331846787.dkr.ecr.us-east-1.amazonaws.com/web-repo-b1dab4a"; // Replace with the actual image name
const apiImageName = "073331846787.dkr.ecr.us-east-1.amazonaws.com/api-repo-bc54424"; // Replace with the actual image name

let webImage = buildAndPushImage(webRepo, "infra-web", webImageName);
let apiImage = buildAndPushImage(apiRepo, "infra-api", apiImageName);

// Create a VPC
const vpc = new awsx.ec2.Vpc("vpc", {
  cidrBlock: "10.0.0.0/16",
  // subnets: [{ type: "public" }, { type: "private" }],
});

// Create a Security Group that allows HTTP inbound access and all outbound access
const webSg = new aws.ec2.SecurityGroup("webSg", {
  vpcId: vpc.vpc.id,
  description: "Enable HTTP access",
  ingress: [
    { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
  tags: {
    Name: "allow_http",
  },
});

// Create a cluster.
const cluster = new aws.ecs.Cluster("cluster");

// Create a load balancer on port 80 and connect it to the web service.
const alb = new aws.lb.LoadBalancer("alb", {
  internal: false,
  loadBalancerType: "application",
  securityGroups: [webSg.id],
  subnets: vpc.publicSubnetIds,
  enableDeletionProtection: true,
  tags: {
    Environment: "dev",
  },
});
const webTargetGroup = new aws.lb.TargetGroup("web-targetgroup", { vpcId: vpc.vpc.id, port: 80, protocol: "HTTP" });
const webListener = new aws.lb.Listener("web-listener", {
  loadBalancerArn: alb.arn,
  port: 80,
  defaultActions: [{
    type: "forward",
    targetGroupArn: webTargetGroup.arn,
  }],
});
// Create AWS Cloud Map namespace
const namespace = new aws.servicediscovery.PrivateDnsNamespace("myNamespace", {
  description: "My private namespace for the application services",
  vpc: vpc.vpc.id,
});

// Register API service in the AWS Cloud Map
const apiServiceDiscovery = new aws.servicediscovery.Service("apiServiceDiscovery", {
  name: "api",
  namespaceId: namespace.id,
  dnsConfig: {
    dnsRecords: [
      { ttl: 10, type: "A" },
      { ttl: 10, type: "SRV" },
    ],
    namespaceId: namespace.id,
    routingPolicy: "MULTIVALUE",
  },
  healthCheckCustomConfig: {
    failureThreshold: 1,
  },
});

// Define task definition for API service
const apiTaskDef = new awsx.ecs.FargateTaskDefinition("api-taskdef", {
  container: {
    image: apiImage.apply(img => img),  // Updated
    memory: 512,
    portMappings: [{ containerPort: 5000 }],
  },
});

const apiService = new awsx.ecs.FargateService("api-svc", {
  cluster: cluster.id,
  taskDefinition: apiTaskDef.taskDefinition.arn,
  networkConfiguration: {
    securityGroups: [webSg.id],
    subnets: vpc.privateSubnetIds,
  },
  serviceRegistries: {
    registryArn: apiServiceDiscovery.arn,
    port: 5000, // Specify the port instead of containerPort
  },
  desiredCount: 1,
});
// Define task definition for web service
const webTaskDef = new awsx.ecs.FargateTaskDefinition("web-taskdef", {
  container: {
    image: webImage.apply(img => img),  // Updated
    memory: 512,
    portMappings: [{ containerPort: 3000 }],
    // Modify the environment variable to point to the Cloud Map service
    environment: [{ name: "ApiAddress", value: pulumi.interpolate`http://api.${namespace.name}:5000/WeatherForecast` }],
  },
});

// Create a web service.
const webService = new awsx.ecs.FargateService("web-svc", {
  cluster: cluster.id,
  taskDefinition: webTaskDef.taskDefinition.arn,
  networkConfiguration: {
    securityGroups: [webSg.id],
    subnets: vpc.privateSubnetIds,
  },
  loadBalancers: [{
    targetGroupArn: webTargetGroup.arn,
    containerName: "web",
    containerPort: 8080,
  }],
  desiredCount: 1,
});

// Export the URL so we can access it.
export const webUrl = alb.dnsName.apply(dns => `http://${dns}`);
