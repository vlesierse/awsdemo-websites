import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Architecture } from 'aws-cdk-lib/aws-lambda';

export class WebsitesStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 Buckets
    const stagingBucket = new s3.Bucket(this, "Staging", { publicReadAccess: false });
    const publishBucket = new s3.Bucket(this, "Publish", { publicReadAccess: false });

    // CloudFront Distribution
    const defaultDistribution = new cloudfront.Distribution(this, "DefaultDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: new origins.S3Origin(publishBucket, { originPath: 'default' }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD
      }
    });

    const europeDistribution = new cloudfront.Distribution(this, "EuropeDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: new origins.S3Origin(publishBucket, { originPath: 'europe' }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD
      }
    });

    // Package Processor
    const handler = new NodejsFunction(this, "PackageProcessorFunction", {
      entry: './src/functions/package-processor/index.ts',
      timeout: Duration.minutes(1),
      memorySize: 512,
      architecture: Architecture.ARM_64,
      environment: {
        WEBSITES_PUBLISH_PREFIX: "default/",
        WEBSITES_PUBLISH_BUCKET: publishBucket.bucketName
      }
    });
    handler.addEventSource(new S3EventSource(stagingBucket, {
      events: [s3.EventType.OBJECT_CREATED],
      filters: [ { prefix: "uploads/" } ],
    }));
    publishBucket.grantPut(handler);
    stagingBucket.grantRead(handler);
  }
}
