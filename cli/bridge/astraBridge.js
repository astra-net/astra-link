const { Bridge } = require('./bridge');
const { AstraWeb3 } = require('../lib/astraWeb3');
const BridgeSol = require("./abi/TokenLockerOnAstra.json");


class AstraBridge extends Bridge {
    constructor(rpcUrl, bridgeAddress) {
        const web3 = new AstraWeb3(rpcUrl);
        const contract = web3.ContractAt(BridgeSol.abi, bridgeAddress);
        // const hprove = null; // TODO
        const { EProver } = require('../../tools/eprover');
        const hprove = new EProver(rpcUrl); // TODO

        super(web3, contract, hprove);
    }

    static async deploy(rpcUrl) {
        console.log({ rpcUrl });
        let web3 = new AstraWeb3(rpcUrl);
        console.log("about to deploy")
        const tx = web3.ContractDeploy(BridgeSol.abi, BridgeSol.bytecode);
        console.log("deployed");
        const contract = await web3.sendTx(tx); //options.address
        console.log("tx");
        return new AstraBridge(rpcUrl, contract._address);
    }
}

module.exports = {
    AstraBridge
}