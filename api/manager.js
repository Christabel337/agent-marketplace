import { Keypair, Horizon } from '@stellar/stellar-sdk';

export default async function handler(req, res) {
  const secret = process.env.MANAGER_SECRET;
  const kp = Keypair.fromSecret(secret);
  const pub = kp.publicKey();
  const server = new Horizon.Server("https://horizon-testnet.stellar.org");

  try {
    const account = await server.loadAccount(pub);
    const bal = parseFloat(account.balances.find(b => b.asset_type === 'native').balance);
    
    // Auto-refill if below 1,000 XLM
    if (bal < 1000) {
      await fetch(`https://friendbot.stellar.org?addr=${pub}`);
    }
    return res.status(200).json({ publicKey: pub, balance: bal });
  } catch (e) {
    // If account doesn't exist, fund it
    await fetch(`https://friendbot.stellar.org?addr=${pub}`);
    return res.status(200).json({ publicKey: pub, balance: 10000 });
  }
}