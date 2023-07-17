# How to Run

install docker on your machine: [Install Docker](https://docs.docker.com/engine/install/)


Open terminal and run:
```
docker-compose up
```

Open a web browser and navigate to 
```
http://localhost:3000
```


# Application Details

- Web: ASP.NET Core 5.0 Web APP
  - this application requires an environment variabled called "ApiAddress" which will be the address of the Web Api.
- API: ASP.NET Core 5.0 Web API

Apologies for the confusion. Here's an updated version of the README.md file including the Pulumi CLI instructions:

```markdown

## Getting Started

These instructions will guide you on how to deploy the infrastructure using Pulumi.

### Prerequisites

- Node.js and npm: [Node.js Installation Guide](https://nodejs.org/en/download/)
- Docker: [Docker Installation Guide](https://docs.docker.com/get-docker/)

### Installation

1. Clone this repository to your local machine.

   ```shell
   git clone <repository-url>
   ```

2. Navigate to the `Pulumi` directory.

   ```shell
   cd Pulumi
   ```

3. Install the dependencies.

   ```shell
   npm install
   ```

### Deployment

1. Install the Pulumi CLI by running the following command:

   ```shell
   npm install -g pulumi
   ```

2. Set up the required configuration values for your AWS environment.

   ```shell
   pulumi config set aws:region <AWS_REGION>
   pulumi config set <CONFIG_KEY> <CONFIG_VALUE>
   ```

   Replace `<AWS_REGION>` with your desired AWS region, and `<CONFIG_KEY>` and `<CONFIG_VALUE>` with the specific configuration values required by your infrastructure.

3. Deploy the infrastructure using the following command:

   ```shell
   pulumi up
   ```

   Review the planned changes and confirm the deployment by typing `yes` when prompted.

4. Pulumi will deploy the infrastructure on AWS. Wait for the deployment to complete.

5. Once the deployment is complete, you can access the web UI using the provided URL.

### Clean Up

To clean up and destroy the created resources, run the following command:

```shell
pulumi destroy
```

Review the planned changes and confirm the destruction by typing `yes` when prompted.

**Note:** Destroying the infrastructure will permanently delete all the resources associated with the stack.