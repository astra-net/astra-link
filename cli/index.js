const { program } = require('commander');
const { genearateDagMTreeRange } = require('./ethashProof/DagMtreeEpoch');
const { getHeaderProof, parseRlpHeader, getBlockByNumber } = require('./ethashProof/BlockProof');
const { blockRelayLoop } = require('./eth2astra-relay/elcRelay');
const { deployELC, statusELC } = require('./elc/contract');
const { merkelRootSol } = require('./ethashProof/MerkelRootSol');
const { EProver } = require('../tools/eprover');
const { deployEVerifier, validateMPTProof } = require('./everifier/contract');
const {
  deployBridges,
  tokenMap, tokenTo, tokenBack,
  tokenStatus, deployFaucet,
  ChangeLightClient, deployFakeLightClient
} = require('./bridge/contract');
const fs = require('fs');

program.description("AstraAstraLink Trustless Bridge CLI");

const Dag_CMD = program.command('dagProve').description('DAG Merkel Tree cli');
Dag_CMD
  .command('generate <epoch_start>')
  .description('generate cache merkle tree for epochs [start, start+num)')
  .option('-n,--num <number>', 'number of epoch processed', 1)
  .option('-d,--dagDir <dag dir>', 'direction to store dag merkel tree', './.dag')
  .option('-t,--type <output type>', 'output type: sol,json', 'sol')
  .option('-o,--output <OUTPUT>', 'output file')
  .action((start, options) => {
    start = Number(start);
    const dagMTrees = genearateDagMTreeRange(options.dagDir, start, options.num);
    const outJson = {
      epoch: start,
      roots: dagMTrees.map(dmt => dmt.merkel.getRoot().toString('hex'))
    };
    const out = options.type == 'json' ? outJson : merkelRootSol(outJson);
    if (!options.output) {
      console.log(out);
    } else {
      const ostr = options.type == 'json' ? JSON.stringify(out) : out
      fs.writeFileSync(options.output, ostr);
    }
  });

Dag_CMD
  .command('blockProof')
  .description('get block proof data')
  .option('-u,--url <eth url>', 'ethereum node RPC url')
  .option('-b,--block <number/hash>', 'block number or hash')
  .option('-H --header <rlpBlockHeader>', 'hexadecimal string of rlp block header')
  .option('-d,--dagDir <dag dir>', 'direction to store dag merkel tree', './.dag')
  .option('-o,--output <OUTPUT>', 'output file')
  .action(async (options) => {
    let header;
    if (options.block) {
      header = await getBlockByNumber(options.url, options.block);
    } else {
      const rlpHeader = Buffer.from(options.header, 'hex');
      header = parseRlpHeader(rlpHeader);
    }
    const proofs = getHeaderProof(options.dagDir, header);

    const _toHex = e => `0x${e.toString('hex')}`;
    const proofJson = {
      header_rlp: _toHex(header.serialize()),
      merkle_root: _toHex(proofs.root),
      elements: proofs.dagData.map(elems => elems.map(_toHex)),
      merkle_proofs: proofs.proofs.map(_toHex),
      proofIndexes: proofs.proofIndexes.map(_toHex),
    }
    if (!options.output) {
      console.log(proofJson);
    } else {
      fs.writeFileSync(options.output, JSON.stringify(proofJson));
    }
  });

const CMD_ELC = program.command('ELC').description('ethereum ligth client cli')
CMD_ELC
  .command('deploy <astraUrl>')
  .description('deploy ELC contract on astra')
  .option('-u,--url <eth url>', 'ethereum node RPC url')
  .option('-b,--block <number/hash>', 'init block number or hash')
  .option('-H --header <rlpBlockHeader>', 'hexadecimal string of rlp block header')
  .action(async (astraUrl, options) => {
    let header;
    if (options.block) {
      header = await getBlockByNumber(options.url, options.block);
    } else {
      const rlpHeader = Buffer.from(options.header, 'hex');
      header = parseRlpHeader(rlpHeader);
    }
    const ELC = await deployELC(astraUrl, header.serialize());
    console.log("ELC:", ELC.options.address);
  });

CMD_ELC
  .command('status <astraUrl> <ELC_address>')
  .description('relay eth block header to elc on astra')
  .action(async (astraUrl, elcAddress) => {
    await statusELC(astraUrl, elcAddress);
  });

const ETHRelay_CMD = program.command('ethRelay').description('ethereum block relay cli');
ETHRelay_CMD
  .command('getBlockHeader <ethUrl> <number/hash>')
  .description('get block header')
  .option('-t --type <output format>', 'output format: json/rlp', 'json')
  .action(async (url, block, options) => {
    const header = await getBlockByNumber(url, block);
    if (options.type == 'rlp')
      console.log(header.serialize().toString('hex'));
    else
      console.log(header.toJSON());
  });

ETHRelay_CMD
  .command('relay <ethUrl> <astraUrl> <elcAddress>')
  .description('relay eth block header to elc on astra')
  .option('-d,--dagDir <dag dir>', 'direction to store dag merkel tree', './.dag')
  .action(async (ethUrl, astraUrl, elcAddress, options) => {
    await blockRelayLoop(options.dagDir, ethUrl, astraUrl, elcAddress);
  });

const CMD_EProver = program.command('EProver').description('ethereum receipt prove cli')

CMD_EProver
  .command('proof <ethUrl> <tx_hash>')
  .description('get receipt proof of a transaction from ethereum')
  .option('-o,--output <OUTPUT>', 'output file')
  .action(async (ethUrl, txHash, options) => {
    const ep = new EProver(ethUrl);
    const proof = await ep.receiptProof(txHash);
    const keys = Object.keys(proof);
    const out = {};
    keys.forEach(key => out[key] = '0x' + proof[key].toString('hex'));
    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(out));
    } else {
      console.log(out);
    }
  });


const CMD_EVerifier = program.command('EVerifier').description('ethereum receipt verify cli');

CMD_EVerifier
  .command('verify <ethUrl> <tx_hash> <astraUrl> <contract address>')
  .description('verify receipt MPT proof vai everifier contract, return receipt')
  .option('-o,--output <OUTPUT>', 'output file')
  .option('-t --type <output format>', 'output format: json/rlp', 'json')
  .action(async (ethUrl, txHash, astraUrl, evAddress, options) => {
    const ep = new EProver(ethUrl);
    const proof = await ep.receiptProof(txHash);
    const receiptObj = await validateMPTProof(astraUrl, evAddress, proof);
    const out = options.type == 'json' ? receiptObj.toJson() : receiptObj.toHex();
    if (options.output) {
      fs.writeFileSync(options.output, out);
    } else {
      console.log(out);
    }
  });

CMD_EVerifier
  .command('deploy <astraUrl>')
  .description('deploy EVerifier library contract on astra')
  .action(async (astraUrl) => {
    const contract = await deployEVerifier(astraUrl);
    console.log("EVerifier:", contract.options.address);
  });


const CMD_Bridge = program.command('Bridge').description('bridge cli');

CMD_Bridge
  .command('deploy <ethUrl> <astraUrl>')
  .description('deploy bridge contract on ethereum and astra and then bind these')
  .action(async (ethUrl, astraUrl) => {
    const { ethBridge, astraBridge } = await deployBridges(ethUrl, astraUrl);
    console.log("ethereum bridge address:", ethBridge.contract._address);
    console.log("astra bridge address:", astraBridge.contract._address);
  });

CMD_Bridge
  .command('map <ethUrl> <ethBridge> <astraUrl> <astraBridge> <token>')
  .description('map ERC20 to ERC20')
  .action(async (ethUrl, ethAddress, astraUrl, astraAddress, token) => {
    const { ethBridge, astraBridge } = await tokenMap(ethUrl, ethAddress, astraUrl, astraAddress, token);

    const pair = await ethBridge.TokenPair(token);
    const ethTokenInfo = await tokenStatus(ethBridge.web3, pair[0], ethBridge.web3.address);
    console.log("ethereum token:", ethTokenInfo);
    const astraTokenInfo = await tokenStatus(astraBridge.web3, pair[1], astraBridge.web3.address);
    console.log("astra token:", astraTokenInfo);
  });

CMD_Bridge
  .command('crossTo <ethUrl> <ethBridge> <astraUrl> <astraBridge> <token> <receipt> <amount>')
  .description('cross transfer ERC20 from eth to astra')
  .action(async (ethUrl, ethAddress, astraUrl, astraAddress, token, receipt, amount) => {
    const { ethBridge, astraBridge } = await tokenTo(ethUrl, ethAddress, astraUrl, astraAddress, token, receipt, amount);

    const pair = await ethBridge.TokenPair(token);
    const ethTokenInfo = await tokenStatus(ethBridge.web3, pair[0], ethBridge.web3.address);
    console.log("ethereum token:", ethTokenInfo);
    const astraTokenInfo = await tokenStatus(astraBridge.web3, pair[1], astraBridge.web3.address);
    console.log("astra token:", astraTokenInfo);
  });

CMD_Bridge
  .command('crossBack <astraUrl> <astraBridge> <ethUrl> <ethBridge> <token> <receipt> <amount>')
  .description('cross transfer ERC20 from astra back to eth')
  .action(async (astraUrl, astraAddress, ethUrl, ethAddress, token, receipt, amount) => {
    const { astraBridge, ethBridge } = await tokenBack(astraUrl, astraAddress, ethUrl, ethAddress, token, receipt, amount);
    const pair = await astraBridge.TokenPair(token, false);
    const ethTokenInfo = await tokenStatus(ethBridge.web3, pair[0], ethBridge.web3.address);
    console.log("ethereum token:", ethTokenInfo);
    const astraTokenInfo = await tokenStatus(astraBridge.web3, pair[1], astraBridge.web3.address);
    console.log("astra token:", astraTokenInfo);
  });

CMD_Bridge
  .command('deployFaucet <rpcUrl>')
  .description('deploy a faucet token')
  .option('-m,--mint', "mint 10000 token to account")
  .action(async (rpcUrl, options) => {
    const faucet = await deployFaucet(rpcUrl);
    if (options.mint) {
      await faucet.mint();
    }
    const faucetTokenInfo = await tokenStatus(faucet.web3, faucet.contract._address, faucet.web3.address);
    console.log(faucetTokenInfo);
  });

CMD_Bridge
  .command('change <rpcUrl> <bridgeAddress> <ligthClient>')
  .description('change light client')
  .action(async (rpcUrl, bridgeAddress, clientAddress) => {
    await ChangeLightClient(rpcUrl, bridgeAddress, clientAddress);
    console.log("done");
  })

CMD_Bridge
  .command('deployFakeClient <rpcUrl>')
  .description('deploy a fake light client for testing')
  .action(async (rpcUrl, options) => {
    const fakeClient = await deployFakeLightClient(rpcUrl);
    console.log(fakeClient);
  })

program.parse(process.argv);