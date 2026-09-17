import "dotenv/config";
import { shopifyGraphQL } from "./shopify/client.js";

interface AccessScopesResponse {
  currentAppInstallation: {
    accessScopes: {
      handle: string;
    }[];
  };
}

const query: string = `{
  currentAppInstallation {
    accessScopes {
      handle
    }
  }
}`;

const result = await shopifyGraphQL<AccessScopesResponse>(query);

console.log(result.currentAppInstallation.accessScopes.map((scope) => scope.handle));
