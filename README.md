# AWS Demo: Websites
This repository demonstrates the usage of AWS CloudFront for hosting static websites by uploading packeges to an S3 bucket. It also contains the process of migrating by using a origin failover and service specific files for viewers from different countries.

## Getting Started

### Prerequisites
- Node.js
- AWS CLI

### Deployment

```sh
npm install
npm run bootstrap # First time running CDK in your account
npm run deploy-lambda # Deploys the Lambda for Edge function in us-east-1 region
npm run deploy # Deploys the required AWS resources
```


