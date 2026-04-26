import { Client, Wallet } from 'xrpl';

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

export async function connectToTestnet(): Promise<Client> {
  const client = new Client(TESTNET_URL);
  await client.connect();
  return client;
}

export async function fundWallet(client: Client): Promise<Wallet> {
  const { wallet } = await client.fundWallet();
  return wallet;
}
