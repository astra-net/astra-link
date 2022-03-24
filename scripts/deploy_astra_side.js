const { ethers } = require("hardhat");
require("dotenv").config();
const { getBlockByNumber } = require("../tools/eth2astra-relay/lib/getBlockHeader.js");

// works with kovan
// npx hardhat run --network localnet scripts/deploy_astra_side.js
async function deployAstraSideContracts() {
  // const Prime = await ethers.getContractFactory("Prime");
  // const prime = await Prime.deploy();
  // await prime.deployed();

  // const Keccak512 = await ethers.getContractFactory("Keccak512");
  // const keccak512 = await Keccak512.deploy();
  // await keccak512.deployed();

  // const MerkleProof = await ethers.getContractFactory("Prime");
  // const merkleProof = await MerkleProof.deploy();
  // await merkleProof.deployed();

  const url = process.env.ETH_NODE_URL;
  const blockNum = 12125940;
  const initHeader = await getBlockByNumber(url, blockNum);

  const EthereumLightClient = await ethers.getContractFactory(
    "EthereumLightClient",
    // {
    //   libraries: {
    //     Prime: prime.address,
    //     Keccak512: keccak512.address
    //   }
    // }
  );

  const ethLightClient = await upgrades.deployProxy(EthereumLightClient,
    [initHeader.serialize()],
    {
      initializer: "initialize",
      // unsafeAllowAstraAstraLinkedLibraries: true
    }
  );
  console.log("EthereumLightClient deployed to:", ethLightClient.address);
  
  // const EthereumProver = await ethers.getContractFactory(
  //   "EthereumProver",
  // );
  // const prover = await EthereumProver.deploy();
  // await prover.deployed();

  // deploy token locker
  const TokenLockerOnAstra = await ethers.getContractFactory(
    "TokenLockerOnAstra",
  );
  const tokenLockerOnAstra = await upgrades.deployProxy(
    TokenLockerOnAstra,
    [],
    {
      initializer: "initialize",
      // unsafeAllowAstraAstraLinkedLibraries: true
    }
  );
  console.log("TokenLockerOnAstra deployed to:", tokenLockerOnAstra.address);

  return [ethLightClient.address, tokenLockerOnAstra.address];
}

// module.exports = {deployAstraSideContracts};
deployAstraSideContracts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });