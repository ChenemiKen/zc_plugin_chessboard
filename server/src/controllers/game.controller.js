// Custom Modules
const response = require("../utils/response");
const CustomError = require("../utils/custom-error");
const gameSchema = require("../models/game.model");
const DatabaseConnection = require("../db/database.helper");
const centrifugoController = require("../controllers/centrifugo.controller");
const { saveToCache, retrieveFromCache } = require("../utils/cacheData");

const GameRepo = new DatabaseConnection("001test_game");
class GameController {
  // Create A Game
  async create(req, res) {
    try {
      // Pass the request body to the schema
      const game = await gameSchema.validateAsync(req.body);

      // Save the game to the database
      const gameDBData = await GameRepo.create(game);

      // Save Game to the cache
      saveToCache(gameDBData.data.object_id, {
        game_owner_user_id: gameDBData.data.game_owner_user_id,
        game_opponent_user_id: null,
        spectators: [],
      });

      // Return the game
      res
        .status(201)
        .send(response("Game created successfully", gameDBData.data));
    } catch (error) {
      throw new CustomError(`Unable to create a Game: ${error}`, "500");
    }
  }

  // Join A Game
  async join(req, res) {
    try {
      // Get the game id and user id from the request body
      const { game_id, user_id } = req.body;

      // Find the game in the database
      const gameDBData = await GameRepo.fetchOne(game_id);

      // Check if the game exists
      if (!gameDBData.data) {
        return res.status(400).send(response("Game not found", null, false));
      }

      // Get gamedate from nodecache - temporary cache
      const gameCacheData = retrieveFromCache(game_id);
      // console.log(gameCacheData);

      // Variable to store user permission in game
      let permission;

      // Check if Player 2 is already set
      if (
        !gameCacheData.game_opponent_user_id &&
        !gameDBData.data.game_opponent_user_id
      ) {
        // Set User ID as Player 2 in the database
        await GameRepo.update(game_id, {
          ...gameDBData.data,
          game_opponent_user_id: user_id,
        });

        // Set User ID as Player 2 in the game cache
        saveToCache(game_id, {
          ...gameCacheData,
          game_opponent_user_id: user_id,
        });

        // Set permission to allow the user play the game
        permission = "READ/WRITE";
      } else {
        // Join as a Spectator

        // Set User ID as Spectator in the game cache
        gameCacheData.spectators.push(user_id);

        // Save the Game to the cache
        saveToCache(game_id, {
          ...gameCacheData,
        });

        // Set permission to allow the user watch the game
        permission = "READ";
      }

      // Build Response
      const payload = {
        event: "join_game",
        permission,
        name: user_id,
      };

      // Publish the event to Centrifugo server
      await centrifugoController.publish(game_id, payload);

      // Return the game
      res
        .status(200)
        .send(response("Game joined successfully", gameDBData.data));
    } catch (error) {
      throw new CustomError(`Unable to Join a Game: ${error}`, "500");
    }
  }

  // Get Game By Id
  // async getById(req, res) {
  // }

  // Get All Games
  async getAll(req, res) {
    req;
    try {
      // Get all games from the database
      const gameDBData = await GameRepo.fetchAll();

      // Return all games
      res
        .status(200)
        .send(response("Games retrieved successfully", gameDBData.data));
    } catch (error) {
      throw new CustomError(`Unable to get all Games: ${error}`, "500");
    }
  }

  // Get All Games By User
  // async getAllByUser(req, res) {
  // }

  // Update Game
  // async update(req, res) {
  // }
}

// Export Module
module.exports = new GameController();
