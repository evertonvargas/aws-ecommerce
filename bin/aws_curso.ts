#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { EcommerceStack } from '../lib/ecommerceapi-stack';
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack';
import { getConfig } from '../lib/config';
import { EventsDdbStack } from '../lib/eventsDdb-stack';

const app = new cdk.App();
const config = getConfig();

const env: cdk.Environment = {
  account: config.account,
  region: "us-east-1"
}

const tags = {
  cost: "Ecommerce",
  team: "EvertonTeam"
}

const productsAppLayersStack = new ProductsAppLayersStack(app, "ProductsAppLayers", {
  tags,
  env
})

const eventsDdbStack = new EventsDdbStack(app, "EventsDdb", {
  tags,
  env
})

const productsAppStack = new ProductsAppStack(app, "ProductsApp", {
  eventsDdb: eventsDdbStack.table,
  tags,
  env
})

productsAppStack.addDependency(productsAppLayersStack);
productsAppStack.addDependency(eventsDdbStack);

const ecommerceApiStack = new EcommerceStack(app, "ECommerceApi", {
  productFetchHandler: productsAppStack.productsFetchHandler,
  productAdminHandler: productsAppStack.productsAdminHandler,
  tags,
  env
})

ecommerceApiStack.addDependency(productsAppStack);