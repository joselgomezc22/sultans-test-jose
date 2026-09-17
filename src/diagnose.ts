import "dotenv/config";
import { shopifyGraphQL } from "./shopify/client.js";

const variantId = "gid://shopify/ProductVariant/42795733614707";

const query = `query Diagnose($id: ID!) {
  productVariant(id: $id) {
    id
    availableForSale
    inventoryPolicy
    inventoryItem {
      id
      tracked
      inventoryLevels(first: 10) {
        nodes {
          location { id }
          quantities(names: ["available", "on_hand", "committed"]) {
            name
            quantity
          }
        }
      }
    }
    product { id status }
  }
}`;

const result = await shopifyGraphQL(query, { id: variantId });
console.log(JSON.stringify(result, null, 2));