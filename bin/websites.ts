#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WebsitesStack } from '../lib/websites-stack';

const app = new cdk.App();
new WebsitesStack(app, 'WebsitesStack', { env: { region: 'eu-west-1' } });