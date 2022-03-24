const EProver = require("../../tools/eprover/abi/EthereumProver.json");
const { AstraWeb3 } = require('../lib/astraWeb3');
const { Receipt } = require('eth-object');

async function deployEVerifier(astraUrl) {
    const astraWeb3 = new AstraWeb3(astraUrl);
    const tx = astraWeb3.ContractDeploy(EProver.abi, EProver.bytecode);
    return await astraWeb3.sendTx(tx); //options.address
}

async function validateMPTProof(astraUrl, evAddress, proof) {
    const astraWeb3 = new AstraWeb3(astraUrl);
    const everifier = astraWeb3.ContractAt(EVerifierTest.abi, evAddress);
    const rlpReceipts = await everifier.methods.validateMPTProof(proof.root, proof.key, proof.proof).call();
    return Receipt.fromHex(rlpReceipts);
}

module.exports = { deployEVerifier, validateMPTProof }