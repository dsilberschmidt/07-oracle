import { OracleExample } from './OracleExample';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
} from 'o1js';

let proofsEnabled = false;

// The public key of our trusted data provider
const ORACLE_PUBLIC_KEY =
  'B62qoAE4rBRuTgC42vqvEyUqCGhaZsW58SKVW4Ht8aYqP9UTvxFWBgy';

describe('OracleExample', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: OracleExample;

  beforeAll(async () => {
    if (proofsEnabled) await OracleExample.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new OracleExample(zkAppAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  it('generates and deploys the `OracleExample` smart contract', async () => {
    await localDeploy();
    const oraclePublicKey = zkApp.oraclePublicKey.get();
    expect(oraclePublicKey).toEqual(PublicKey.fromBase58(ORACLE_PUBLIC_KEY));
  });

  describe('hardcoded values', () => {
    it('check random number < 50', async () => {
   
      await localDeploy();

      const response = await fetch('https://api.random.org/json-rpc/1/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "jsonrpc": "2.0",
          "method": "generateIntegers",
          "params": {
              "apiKey": "22f2ac92-064f-4d47-904c-d2831faffcac",  // not working random_key from .env
              "n": 1,
              "min": 1,
              "max": 50,
              "replacement": true
          },
          "id": 1
        })
      });
      

      const result_json = await response.json();

      //console.log("json POST: ", result_json.result);
      console.log("number: ",result_json.result.random.data[0])
     
      const id = Field(1);
      const randomNumber = Field(787);
      const signature = Signature.fromBase58(
        '7mXGPCbSJUiYgZnGioezZm7GCy46CEUbgcCH9nrJYXQQiwwVrA5wemBX4T1XFHUw62oR2324QNnkUVXW6yYQLsPsqxZ3nsYR'
      );
      
      const txn = await Mina.transaction(senderAccount, () => {
          zkApp.verify(id, randomNumber, signature);
      });

      
      await txn.prove();
      await txn.sign([senderKey]).send();

      const events = await zkApp.fetchEvents();
      const verifiedEventValue = events[0].event.data.toFields(null)[0];
      expect(verifiedEventValue).toEqual(id);
    });
  });
});
