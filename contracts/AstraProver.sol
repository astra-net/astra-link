// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.3;
pragma experimental ABIEncoderV2;

// largely based on
// https://github.com/loredanacirstea/goldengate/blob/master/contracts/contracts/Prover.sol

import "./AstraParser.sol";
import "./AstraLightClient.sol";
import "./lib/MMRVerifier.sol";
import "./lib/ECVerify.sol";
import "./lib/MPT.sol";

library AstraProver {
    using MPT for MPT.MerkleProof;

    function verifyTrieProof(MPT.MerkleProof memory data)
        internal
        pure
        returns (bool)
    {
        return data.verifyTrieProof();
    }

    function verifyHeader(
        AstraParser.BlockHeader memory header,
        MMRVerifier.MMRProof memory proof
    ) internal pure returns (bool valid, string memory reason) {
        bytes32 blockHash = AstraParser.getBlockHash(header);
        if (blockHash != header.hash)
            return (false, "Header data or hash invalid");

        // Check block hash was registered in light client
        valid = MMRVerifier.inclusionProof(
            proof.root,
            proof.width,
            proof.index,
            blockHash,
            proof.peaks,
            proof.siblings
        );
        if (!valid) return (false, "verifyHeader - invalid proof");

        return (true, "");
    }

    function verifyTransaction(
        AstraParser.BlockHeader memory header,
        MPT.MerkleProof memory txdata
    ) internal pure returns (bool valid, string memory reason) {
        if (header.transactionsRoot != txdata.expectedRoot)
            return (false, "verifyTransaction - different trie roots");

        valid = txdata.verifyTrieProof();
        if (!valid) return (false, "verifyTransaction - invalid proof");

        return (true, "");
    }

    function verifyReceipt(
        AstraParser.BlockHeader memory header,
        MPT.MerkleProof memory receiptdata
    ) internal pure returns (bool valid, string memory reason) {
        if (header.receiptsRoot != receiptdata.expectedRoot)
            return (false, "verifyReceipt - different trie roots");

        valid = receiptdata.verifyTrieProof();
        if (!valid) return (false, "verifyReceipt - invalid proof");

        return (true, "");
    }

    function verifyAccount(
        AstraParser.BlockHeader memory header,
        MPT.MerkleProof memory accountdata
    ) internal pure returns (bool valid, string memory reason) {
        if (header.stateRoot != accountdata.expectedRoot)
            return (false, "verifyAccount - different trie roots");

        valid = accountdata.verifyTrieProof();
        if (!valid) return (false, "verifyAccount - invalid proof");

        return (true, "");
    }

    function verifyLog(
        MPT.MerkleProof memory receiptdata,
        bytes memory logdata,
        uint256 logIndex
    ) internal pure returns (bool valid, string memory reason) {
        AstraParser.TransactionReceiptTrie memory receipt = AstraParser
            .toReceipt(receiptdata.expectedValue);

        if (
            keccak256(logdata) ==
            keccak256(AstraParser.getLog(receipt.logs[logIndex]))
        ) {
            return (true, "");
        }
        return (false, "Log not found");
    }

    function verifyTransactionAndStatus(
        AstraParser.BlockHeader memory header,
        MPT.MerkleProof memory receiptdata
    ) internal pure returns (bool valid, string memory reason) {}

    function verifyCode(
        AstraParser.BlockHeader memory header,
        MPT.MerkleProof memory accountdata
    ) internal pure returns (bool valid, string memory reason) {}

    function verifyStorage(
        MPT.MerkleProof memory accountProof,
        MPT.MerkleProof memory storageProof
    ) internal pure returns (bool valid, string memory reason) {
        AstraParser.Account memory account = AstraParser.toAccount(
            accountProof.expectedValue
        );

        if (account.storageRoot != storageProof.expectedRoot)
            return (false, "verifyStorage - different trie roots");

        valid = storageProof.verifyTrieProof();
        if (!valid) return (false, "verifyStorage - invalid proof");

        return (true, "");
    }

    function getTransactionSender(
        MPT.MerkleProof memory txdata,
        uint256 chainId
    ) internal pure returns (address sender) {
        AstraParser.Transaction memory transaction = AstraParser
            .toTransaction(txdata.expectedValue);
        bytes memory txraw = AstraParser.getTransactionRaw(
            transaction,
            chainId
        );

        bytes32 message_hash = keccak256(txraw);
        sender = ECVerify.ecverify(
            message_hash,
            transaction.v,
            transaction.r,
            transaction.s
        );
    }

    function getTransactionHash(bytes memory signedTransaction)
        internal
        pure
        returns (bytes32 hash)
    {
        hash = keccak256(signedTransaction);
    }

    function getBlockHash(AstraParser.BlockHeader memory header)
        internal
        pure
        returns (bytes32 hash)
    {
        return keccak256(getBlockRlpData(header));
    }

    function getBlockRlpData(AstraParser.BlockHeader memory header)
        internal
        pure
        returns (bytes memory data)
    {
        return AstraParser.getBlockRlpData(header);
    }

    function toBlockHeader(bytes memory data)
        internal
        pure
        returns (AstraParser.BlockHeader memory header)
    {
        return AstraParser.toBlockHeader(data);
    }

    function getLog(AstraParser.Log memory log)
        internal
        pure
        returns (bytes memory data)
    {
        return AstraParser.getLog(log);
    }

    function getReceiptRlpData(
        AstraParser.TransactionReceiptTrie memory receipt
    ) internal pure returns (bytes memory data) {
        return AstraParser.getReceiptRlpData(receipt);
    }

    function toReceiptLog(bytes memory data)
        internal
        pure
        returns (AstraParser.Log memory log)
    {
        return AstraParser.toReceiptLog(data);
    }

    function toReceipt(bytes memory data)
        internal
        pure
        returns (AstraParser.TransactionReceiptTrie memory receipt)
    {
        return AstraParser.toReceipt(data);
    }

    function toTransaction(bytes memory data)
        internal
        pure
        returns (AstraParser.Transaction memory transaction)
    {
        return AstraParser.toTransaction(data);
    }

    function toAccount(bytes memory data)
        internal
        pure
        returns (AstraParser.Account memory account)
    {
        return AstraParser.toAccount(data);
    }
}
