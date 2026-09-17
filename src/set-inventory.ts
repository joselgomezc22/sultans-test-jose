import "dotenv/config";
import { shopifyGraphQL } from "./shopify/client.js";

const variantId = "gid://shopify/ProductVariant/42795733614707";
const desiredAvailable = 5000;

interface VariantInventoryResponse {
  productVariant: {
    id: string;
    inventoryItem: {
      id: string;
      inventoryLevels: {
        nodes: {
          location: {
            id: string;
          };
          quantities: {
            name: string;
            quantity: number;
          }[];
        }[];
      };
    };
  } | null;
}

const variantQuery: string = `query getVariantInventory($id: ID!) {
  productVariant(id: $id) {
    id
    inventoryItem {
      id
      inventoryLevels(first: 5) {
        nodes {
          location {
            id
          }
          quantities(names: ["available", "committed"]) {
            name
            quantity
          }
        }
      }
    }
  }
}`;

const variantResult = await shopifyGraphQL<VariantInventoryResponse>(variantQuery, {
  id: variantId,
});

if (!variantResult.productVariant) {
  throw new Error(`Variant not found: ${variantId}`);
}

const inventoryItemId = variantResult.productVariant.inventoryItem.id;
const inventoryLevel = variantResult.productVariant.inventoryItem.inventoryLevels.nodes[0];

if (!inventoryLevel) {
  throw new Error(`No inventory location found for variant: ${variantId}`);
}

const location = inventoryLevel.location;
const currentAvailable =
  inventoryLevel.quantities.find((q) => q.name === "available")?.quantity ?? 0;
const currentCommitted =
  inventoryLevel.quantities.find((q) => q.name === "committed")?.quantity ?? 0;

// Setting name: "available" targets that bucket directly — Shopify adjusts
// on_hand to compensate for committed, so we don't add committed ourselves.
console.log(
  `current available=${currentAvailable}, committed=${currentCommitted} -> setting available=${desiredAvailable}`
);

interface InventorySetQuantitiesResponse {
  inventorySetQuantities: {
    inventoryAdjustmentGroup: {
      createdAt: string;
      reason: string;
      changes: {
        name: string;
        delta: number;
        quantityAfterChange: number;
      }[];
    } | null;
    userErrors: {
      field: string[];
      message: string;
    }[];
  };
}

const mutation: string = `mutation inventorySetQuantities($input: InventorySetQuantitiesInput!, $idempotencyKey: String!) {
  inventorySetQuantities(input: $input) @idempotent(key: $idempotencyKey) {
    inventoryAdjustmentGroup {
      createdAt
      reason
      changes {
        name
        delta
        quantityAfterChange
      }
    }
    userErrors {
      field
      message
    }
  }
}`;

const variables = {
  idempotencyKey: crypto.randomUUID(),
  input: {
    name: "available",
    reason: "correction",
    quantities: [
      {
        inventoryItemId,
        locationId: location.id,
        quantity: desiredAvailable,
        changeFromQuantity: currentAvailable,
      },
    ],
  },
};

const result = await shopifyGraphQL<InventorySetQuantitiesResponse>(mutation, variables);

console.log(JSON.stringify(result, null, 2));