#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { EcommerceStack } from '../lib/ecommerceapi-stack';
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack';
import { getConfig } from '../lib/config';
import { EventsDdbStack } from '../lib/eventsDdb-stack';
import { OrdersAppStack } from '../lib/ordersApp-stack';
import { OrdersAppLayersStack } from '../lib/ordersAppLayers-stack';

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


const ordersAppLayersStack = new OrdersAppLayersStack(app, "OrdersAppLayers", {
  tags,
  env
})

const ordersAppStack = new OrdersAppStack(app, "OrdersApp", {
  productsDdb: productsAppStack.productsDdb,
  tags,
  env
})

ordersAppStack.addDependency(productsAppStack);
ordersAppStack.addDependency(ordersAppLayersStack);

const ecommerceApiStack = new EcommerceStack(app, "ECommerceApi", {
  productFetchHandler: productsAppStack.productsFetchHandler,
  productAdminHandler: productsAppStack.productsAdminHandler,
  ordersHandler: ordersAppStack.ordersHandler,
  tags,
  env
})

ecommerceApiStack.addDependency(productsAppStack);
ecommerceApiStack.addDependency(ordersAppStack);