import StellarSdk from '@stellar/stellar-sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { destination, amount, mode } = req.body;
  const secret = process.env.MANAGER_SECRET; // Safe! Backend only.

  if (!secret) return res.status(500).json({ error: "MANAGER_SECRET not set" });

  const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
  const managerKP = StellarSdk.Keypair.fromSecret(secret);

  try {
    const account = await server.loadAccount(managerKP.publicKey());
    const fee = await server.fetchBaseFee();

    const operation = mode === 'create'
      ? StellarSdk.Operation.createAccount({
          destination,
          startingBalance: String(amount),
        })
      : StellarSdk.Operation.payment({
          destination,
          asset: StellarSdk.Asset.native(),
          amount: String(amount),
        });

    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
    .addOperation(operation)
    .setTimeout(30)
    .build();

    transaction.sign(managerKP);
    const result = await server.submitTransaction(transaction);
    
    return res.status(200).json({ hash: result.hash });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}