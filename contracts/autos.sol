// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";


contract MR_AUTOS is ERC721, Ownable {
    using Strings for uint256;

    enum Rarity { Common, Rare, Epic }

    uint256 public constant MAX_SUPPLY = 30;
    uint256 public constant MINT_PRICE = 10 ether;

    uint256 public totalSupply;
    address public gameContract;
    string public baseImageURI;

    struct Car {
        Rarity rarity;
        uint8 model;
        uint8 maxRaces;
    }

    mapping(uint256 => Car) internal cars;

    constructor(address _gameContract, string memory _baseImageURI)
        ERC721("MicroRacers POL", "MRPOL")
        Ownable(msg.sender)
    {
        require(_gameContract != address(0), "Game invalido");
        gameContract = _gameContract;
        baseImageURI = _baseImageURI;
    }

    function setBaseImageURI(string calldata uri) external onlyOwner {
        baseImageURI = uri;
    }

    function mint() external payable {
        require(totalSupply < MAX_SUPPLY, "Max supply alcanzado");
        require(msg.value == MINT_PRICE, "Mint = 10 POL");

        (bool sent, ) = gameContract.call{value: msg.value}("");
        require(sent, "Fallo envio al juego");

        uint256 tokenId = ++totalSupply;

        uint256 rnd = uint256(
            keccak256(
                abi.encodePacked(block.timestamp, msg.sender, tokenId, block.prevrandao)
            )
        ) % 100;

        Rarity rarity;
        uint8 maxRaces;

        if (rnd < 70) {
            rarity = Rarity.Common;
            maxRaces = 20;
        } else if (rnd < 95) {
            rarity = Rarity.Rare;
            maxRaces = 21;
        } else {
            rarity = Rarity.Epic;
            maxRaces = 22;
        }

        uint8 model = uint8(rnd % 3);

        cars[tokenId] = Car(rarity, model, maxRaces);
        _safeMint(msg.sender, tokenId);
    }

    function maxRacesOf(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Auto inexistente");
        return cars[tokenId].maxRaces;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Auto inexistente");

        Car memory c = cars[tokenId];

        string memory prefix =
            c.rarity == Rarity.Common ? "common_" :
            c.rarity == Rarity.Rare   ? "rare_"   : "epic_";

        string memory image = string.concat(
            baseImageURI,
            prefix,
            (uint256(c.model) + 1).toString(),
            ".png"
        );

        string memory rarityStr =
            c.rarity == Rarity.Common ? "Common" :
            c.rarity == Rarity.Rare   ? "Rare"   : "Epic";

        bytes memory data = abi.encodePacked(
            '{"name":"MicroRacer #', tokenId.toString(),
            '","description":"MicroRacers POL - Carreras NFT on-chain.",',
            '"image":"', image, '",',
            '"attributes":[',
                '{"trait_type":"Rarity","value":"', rarityStr, '"},',
                '{"trait_type":"MaxRaces","value":', uint256(c.maxRaces).toString(), '}',
            ']}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(data));
    }
}
