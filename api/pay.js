import { Keypair, Horizon, Networks, TransactionBuilder, Asset, Operation } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { destination, amount } = req.body;
  if (!destination || !amount) {
    return res.status(400).json({ error: { message: 'destination and amount are required' } });
  }

  const managerSecret = process.env.MANAGER_SECRET;
  if (!managerSecret) {
    return res.status(500).json({ error: { message: 'Manager secret not configured' } });
  }

  try {
    const managerKP = Keypair.fromSecret(managerSecret);
    const account = await server.loadAccount(managerKP.publicKey());
    const fee = await server.fetchBaseFee();

    const tx = new TransactionBuilder(account, {
      fee,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.payment({
        destination,
        asset: Asset.native(),
        amount: String(amount),
      }))
      .setTimeout(30)
      .build();

    tx.sign(managerKP);
    const result = await server.submitTransaction(tx);

    return res.status(200).json({ hash: result.hash, ledger: result.ledger });
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
