import "dotenv/config";
import { shopifyGraphQL } from "./shopify/client.js";
import { mkConfig, generateCsv, asString } from "export-to-csv"; //https://www.npmjs.com/package/export-to-csv library 
import { writeFile, mkdirSync } from "node:fs";
import { Buffer } from "node:buffer";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
mkdirSync(dataDir, { recursive: true });


interface CustomerListResponse {
  customers: {
    nodes: {
      id: string;
      firstName: string;
      lastName: string;
      defaultEmailAddress: {
        emailAddress: string;
        marketingState: string;
      };
      amountSpent: {
        amount: string;
        currencyCode: string;
      }
    }[];
  };
}
const csvConfig = mkConfig({ useKeysAsHeaders: true });
const query: string = `query CustomerList {
    customers(first: 50, query: "tag:task1 AND tag:level:3") {
      nodes {
        id
        firstName
        lastName
        defaultEmailAddress {
          emailAddress
          marketingState
        }
        amountSpent {
            amount
            currencyCode
        }
      }
    }
  }`;


const clientList = await shopifyGraphQL<CustomerListResponse>(query);

const customerRows = clientList.customers.nodes
  .slice()
  .sort((a, b) => Number(b.amountSpent.amount) - Number(a.amountSpent.amount))
  .map(customer => ({
    id: customer.id.replace("gid://shopify/Customer/", ""),
    amountSpent: `${customer.amountSpent.amount} ${customer.amountSpent.currencyCode}`,
    firstName: customer.firstName,
    lastName: customer.lastName,
    emailAddress: customer.defaultEmailAddress?.emailAddress ?? "",
    marketingState: customer.defaultEmailAddress?.marketingState ?? "",
    
  }));

// Converts your Array<Object> to a CsvOutput string based on the configs
const csv = generateCsv(csvConfig)(customerRows);
const filename = join(dataDir, `top_50_spenders-${Date.now()}.csv`);
const csvBuffer = new Uint8Array(Buffer.from(asString(csv)));

// Write the csv file to disk
writeFile(filename, csvBuffer, (err) => {
  if (err) throw err;
  console.log("file saved: ", filename);
});