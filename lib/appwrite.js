import { Client, Account, Databases, Functions, Storage, Teams, ID, Permission, Role } from 'appwrite';

let client = new Client();

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'qloohack';

client
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

const account = new Account(client);
const databases = new Databases(client);
const functions = new Functions(client);
const storage = new Storage(client);
const teams = new Teams(client);

// Validate client configuration
const validateClient = () => {
  if (!client.config.endpoint || !client.config.project) {
    console.error('Appwrite client not properly configured: missing endpoint or project. Set NEXT_PUBLIC_APPWRITE_ENDPOINT and NEXT_PUBLIC_APPWRITE_PROJECT_ID.');
    return false;
  }
  if (client.config.project === 'qloohack') {
    console.error('Appwrite project ID is using a placeholder (qloohack). Set NEXT_PUBLIC_APPWRITE_PROJECT_ID to your actual Appwrite project ID.');
    return false;
  }
  return true;
};

// Export with validation
export { account, client, databases, functions, storage, teams, validateClient, ID, Permission, Role };