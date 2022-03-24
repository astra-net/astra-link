const ElcABI = require("../../tools/elc/abi/EthereumLightClient.json");
const { getBlockByNumber, getHeaderProof } = require('../ethashProof/BlockProof');
const { AstraWeb3 } = require('../lib/astraWeb3');
const Web3 = require('web3');

async function blockRelay(dagPath, ethUrl, astraWeb3, elcAddress) {
    const client = astraWeb3.ContractAt(ElcABI.abi, elcAddress);
    const clientMethods = client.methods;
    const lastBlockNo = await clientMethods.getBlockHeightMax().call();
    console.log("ELC last block number:", lastBlockNo);
    const blockRelay = Number(lastBlockNo) + 1;
    console.log("block to relay:", blockRelay);
    const header = await getBlockByNumber(ethUrl, blockRelay);
    this.web3 = new Web3(ethUrl);
    console.log('header hash', this.web3.utils.keccak256(header.serialize()));
    const proofs = getHeaderProof(dagPath, header)
    const rlpHeader = header.serialize();
    try {
        await clientMethods.addBlockHeader(rlpHeader, proofs.dagData, proofs.proofs).send({ gas: 5000000 });
    } catch (error) {
        console.log(error);
    }
    const blockNo = await clientMethods.getBlockHeightMax().call();
    console.log("new block number:", blockNo);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function blockRelayLoop(dagPath, ethUrl, astraUrl, elcAddress) {
    const astraWeb3 = new AstraWeb3(astraUrl);
    while (1) {
        try {
            blockRelay(dagPath, ethUrl, astraWeb3, elcAddress);
        } catch (e) {
            console.error(e);
        }
        await sleep(10000);
    }
}

module.exports = {
    blockRelayLoop
}
