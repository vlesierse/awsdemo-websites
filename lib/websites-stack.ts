import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class WebsitesStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 Buckets
    const stagingBucket = new s3.Bucket(this, "Staging", { publicReadAccess: false });
    const publishBucket = new s3.Bucket(this, "Publish", { publicReadAccess: false, websiteIndexDocument: "index.html" });

    // Migration
    const migrationDistribution = new cloudfront.Distribution(this, "MigrationDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: new origins.S3Origin(publishBucket, { originPath: 'migration' })
      }
    });

    // CloudFront Distribution
    const defaultOrigin = new origins.S3Origin(publishBucket, { originPath: 'default' });
    const countryOrigin = new origins.S3Origin(publishBucket, { 
      originPath: 'default',
        customHeaders: {
          "X-Websites-Countries": "BE,BG,CZ,DK,DE,EE,IE,EL,ES,FR,HR,IT,CY,LV,LT,LU,HU,MT,NL,AT,PL,PT,RO,SI,SK,FI,SE",
          "X-Websites-Countries-Path": "/eu"
        }
    });
    const migrationOrigin = new origins.HttpOrigin(migrationDistribution.distributionDomainName);
    const countryOriginGroup = new origins.OriginGroup({
      primaryOrigin: countryOrigin,
      fallbackOrigin: defaultOrigin,
      fallbackStatusCodes: [403, 404]
    });
    const migrationOriginGroup = new origins.OriginGroup({
      primaryOrigin: defaultOrigin,
      fallbackOrigin: migrationOrigin,
      fallbackStatusCodes: [403, 404]
    });

    const countryCachePolicy = new cloudfront.CachePolicy(this, "CountryCachePolicy", {
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList("CloudFront-Viewer-Country")
    });
    const originSelectorFunction = new cloudfront.experimental.EdgeFunction(this, 'OriginSelectorFunction', {
      runtime: lambda.Runtime.NODEJS_14_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('./src/functions/origin-selector'),
      stackId: "LambdaEdgeStack"
    });

    // Distributions
    new cloudfront.Distribution(this, "DefaultDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: migrationOriginGroup,
      },
      additionalBehaviors: {
        "/manifests/*": {
          origin: countryOriginGroup,
          cachePolicy: countryCachePolicy,
          edgeLambdas: [
            {
              functionVersion: originSelectorFunction.currentVersion,
              eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST
            }
          ]
        }
      }
    });

    // Package Processor
    const packageProcessorFunction = new NodejsFunction(this, "PackageProcessorFunction", {
      entry: './src/functions/package-processor/index.ts',
      timeout: Duration.minutes(1),
      memorySize: 512,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        WEBSITES_PUBLISH_PREFIX: "default/",
        WEBSITES_PUBLISH_BUCKET: publishBucket.bucketName
      }
    });
    packageProcessorFunction.addEventSource(new S3EventSource(stagingBucket, {
      events: [s3.EventType.OBJECT_CREATED],
      filters: [ { prefix: "uploads/" } ],
    }));
    publishBucket.grantPut(packageProcessorFunction);
    stagingBucket.grantRead(packageProcessorFunction);
  }
}
