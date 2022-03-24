const Client = require("../../tools/elc/abi/EthereumLightClient.json");
const { AstraWeb3 } = require("../lib/astraWeb3");
const { BN } = require("ethereumjs-util");

async function deployELC(astraUrl, rlpHeader) {
    const astraWeb3 = new AstraWeb3(astraUrl);
    const tx = astraWeb3.ContractDeploy(Client.abi, Client.bytecode, [rlpHeader]);
    const elc = await astraWeb3.sendTx(tx); //options.address
    const gas = await elc.methods.initialize(rlpHeader).estimateGas();
    await elc.methods.initialize(rlpHeader).send({gas});
    return elc;
}

function printBlock(block) {
    const keys = Object.keys(block).filter((key) => isNaN(Number(key)));
    const blockFormat = {};
    keys.forEach((key) => {
        let value = block[key];
        if (value.length > 64) value = "0x" + new BN(value).toString("hex");
        blockFormat[key] = value;
    });
    console.log(blockFormat);
}

async function statusELC(astraUrl, elcAddress) {
    const astraWeb3 = new AstraWeb3(astraUrl);
    const ELC = astraWeb3.ContractAt(Client.abi, elcAddress);
    const elcMethods = ELC.methods;

    const finalityConfirms = await elcMethods.finalityConfirms().call();
    console.log("finalityConfirms:", finalityConfirms);
    const getBlockHeightMax = await elcMethods.getBlockHeightMax().call();
    const lastBlockNo = await elcMethods
        .blocksByHeight(getBlockHeightMax, 0)
        .call();
    const lastBlock = await elcMethods.blocks(lastBlockNo).call();
    console.log("last block:");
    printBlock(lastBlock);
    /*
      const firstBlockNo = await elcMethods.firstBlock().call();
      const firstBlock = await elcMethods.blocks(firstBlockNo).call();
      console.log('first block:')
      printBlock(firstBlock);
      */
}

module.exports = { deployELC, statusELC };
