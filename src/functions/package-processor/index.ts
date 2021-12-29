import { S3Event } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as unzipper from "unzipper";
import * as stream from "stream";
import * as path from "path";
import * as mime from "mime-types";

const s3 = new AWS.S3();

const publishBucket = process.env.WEBSITES_PUBLISH_BUCKET || "";
const publishPrefix = process.env.WEBSITES_PUBLISH_PREFIX || "";
const publishBatchSize = parseInt(process.env.WEBSITE_PUBLISH_BATCHSIZE || '10');

const uploadStream = (bucket: string, key: string) => {
  const pass = new stream.PassThrough();
  return {
    writeStream: pass,
    promise: s3.upload({ Bucket: bucket, Key: key, ContentType: mime.lookup(key) || undefined, Body: pass }).promise(),
  };
}

export const handler = async (event: S3Event) => {
  let promises = new Array<Promise<AWS.S3.ManagedUpload.SendData>>();
  for await (const record of event.Records) {
    const packageStream = s3.getObject({
      Bucket: record.s3.bucket.name,
      Key: record.s3.object.key
    })
    .createReadStream()
    .on("error", (e) => console.log(`Error extracting file: `, e))
    .pipe(unzipper.Parse({forceStream: true}));

    const targetFolder = path.basename(record.s3.object.key, path.extname(record.s3.object.key));
    for await (const entry of packageStream) {
      const fileName = entry.path;
      if (entry.type.match(/file/ig)) {      
        const { writeStream, promise } = uploadStream(publishBucket, `${publishPrefix}${targetFolder}/${fileName}`);
        entry.pipe(writeStream);
        promises.push(promise);
      } else {
        entry.autodrain();
      }
    }
    if (promises.length === publishBatchSize) {
      await Promise.all(promises);
      promises = [];
    }
  }
  if (promises.length === 0) {
    return;
  }
  await Promise.all(promises);
}

