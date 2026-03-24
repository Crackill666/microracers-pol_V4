// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMR_AUTOS {
    function ownerOf(uint256 tokenId) external view returns (address);
    function maxRacesOf(uint256 tokenId) external view returns (uint256);
}

contract MR_JUEGO {
    uint256 public constant PRICE = 10 ether;
    uint256 public constant ROI_BPS = 12000;
    uint256 public constant BPS = 10000;
    uint256 public constant MAX_RETURN = 12 ether;

    uint256 public constant COOLDOWN = 10 minutes;

    uint256 public constant REWARD_FIRST = 0.835 ether;
    uint256 public constant REWARD_SECOND = 0.522 ether;
    uint256 public constant REWARD_THIRD = 0.522 ether;
    uint256 public constant REWARD_FOURTH_PLUS = 0.5 ether;

    uint8 public constant STATUS_ACTIVE = 0;
    uint8 public constant STATUS_READY_TO_CLAIM = 1;
    uint8 public constant STATUS_RETIRED = 2;

    address public owner;
    address public autos;
    bool public autosLocked;

    struct CarState {
        uint256 racesUsed;
        uint256 maxRaces;
        uint256 accumulatedReturn;
        uint256 maxReturn;
        uint8 status;
        uint256 lastRaceAt;
        bool initialized;
    }

    mapping(uint256 => CarState) public carState;

    event RaceRecorded(
        uint256 tokenId,
        address player,
        uint8 position,
        uint256 reward,
        uint256 accumulatedReturn,
        uint256 racesUsed,
        uint8 status
    );

    event CarReadyToClaim(uint256 tokenId);
    event RewardClaimed(uint256 tokenId, address player, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Solo owner");
        _;
    }

    receive() external payable {}

    function setAutos(address autosAddress) external onlyOwner {
        require(!autosLocked, "Autos ya seteado");
        require(autosAddress != address(0), "Autos invalido");
        autos = autosAddress;
        autosLocked = true;
    }

    function _init(uint256 tokenId) internal {
        if (!carState[tokenId].initialized) {
            uint256 maxRaces = IMR_AUTOS(autos).maxRacesOf(tokenId);
            carState[tokenId] = CarState({
                racesUsed: 0,
                maxRaces: maxRaces,
                accumulatedReturn: 0,
                maxReturn: MAX_RETURN,
                status: STATUS_ACTIVE,
                lastRaceAt: 0,
                initialized: true
            });
        }
    }

    function _rewardForPosition(uint8 position) internal pure returns (uint256) {
        if (position == 1) return REWARD_FIRST;
        if (position == 2 || position == 3) return REWARD_SECOND;
        return REWARD_FOURTH_PLUS;
    }

    function race(uint256 tokenId, uint8 position) external {
        require(autosLocked, "Autos no configurado");
        require(position >= 1, "Posicion invalida");
        require(IMR_AUTOS(autos).ownerOf(tokenId) == msg.sender, "No sos owner");

        _init(tokenId);
        CarState storage c = carState[tokenId];

        require(c.status == STATUS_ACTIVE, "Auto no activo");
        require(c.accumulatedReturn < c.maxReturn, "Max retorno alcanzado");
        require(c.racesUsed < c.maxRaces, "Sin carreras");
        require(block.timestamp >= c.lastRaceAt + COOLDOWN, "Cooldown activo");

        c.racesUsed += 1;

        uint256 reward = _rewardForPosition(position);
        uint256 newAccumulated = c.accumulatedReturn + reward;
        if (newAccumulated > c.maxReturn) {
            reward = c.maxReturn - c.accumulatedReturn;
            newAccumulated = c.maxReturn;
        }

        c.accumulatedReturn = newAccumulated;
        c.lastRaceAt = block.timestamp;

        if (c.accumulatedReturn == c.maxReturn || c.racesUsed == c.maxRaces) {
            c.status = STATUS_READY_TO_CLAIM;
            emit CarReadyToClaim(tokenId);
        }

        emit RaceRecorded(
            tokenId,
            msg.sender,
            position,
            reward,
            c.accumulatedReturn,
            c.racesUsed,
            c.status
        );
    }

    function claimReward(uint256 tokenId) external {
        require(autosLocked, "Autos no configurado");
        require(IMR_AUTOS(autos).ownerOf(tokenId) == msg.sender, "No sos owner");

        CarState storage c = carState[tokenId];
        require(c.initialized, "Auto sin historial");
        require(c.status == STATUS_READY_TO_CLAIM, "No listo para retirar");

        uint256 amount = c.accumulatedReturn;
        require(amount > 0, "Sin recompensa");
        require(address(this).balance >= amount, "Pool sin fondos");

        c.status = STATUS_RETIRED;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Pago fallido");

        emit RewardClaimed(tokenId, msg.sender, amount);
    }

    function withdrawPool(address payable to, uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Fondos insuficientes");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Fallo retiro");
    }
}
