import type { Request, Response, NextFunction } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientsService } from "../clients.service.ts";
import { clientsController } from "../clients.controller.ts";

vi.mock("./clients.service.ts", () => ({
  clientsService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    searchClient: vi.fn(),
    create: vi.fn(),
    replace: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("clientsController", () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {},
      body: {},
    } as Request;

    res = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as Response;

    next = vi.fn();
  });

  describe("getClients", () => {
    it("should return all clients", async () => {
      const clients = [
        {
          id: "1",
          name: "John",
          lastName: "Doe",
          email: "john@example.com",
          shipAddress: "123 Main Street",
          createdAt: new Date(),
        },
        {
          id: "2",
          name: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          shipAddress: "123 Main Street",
          createdAt: new Date(),
        },
      ];

      vi.mocked(clientsService.getAll).mockResolvedValue(clients);

      await clientsController.getClients(req, res, next);

      expect(clientsService.getAll).toHaveBeenCalledOnce();
      expect(res.json).toHaveBeenCalledWith(clients);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next when the service throws an error", async () => {
      const error = new Error("Database error");

      vi.mocked(clientsService.getAll).mockRejectedValue(error);

      await clientsController.getClients(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("should return a client by id", async () => {
      const client = {
        id: "123",
        name: "John",
        lastName: "Doe",
        email: "john@example.com",
        shipAddress: "123 Main Street",
        createdAt: new Date(),
      };

      req.params = { id: "123" };

      vi.mocked(clientsService.getById).mockResolvedValue(client);

      await clientsController.getById(req, res, next);

      expect(clientsService.getById).toHaveBeenCalledWith("123");
      expect(res.json).toHaveBeenCalledWith(client);
      expect(next).not.toHaveBeenCalled();
    });

    it("should use the first value when id is an array", async () => {
      const client = {
        id: "123",
        name: "John",
        lastName: "Doe",
        email: "john@example.com",
        shipAddress: "123 Main Street",
        createdAt: new Date(),
      };

      req.params = { id: ["123", "456"] };

      vi.mocked(clientsService.getById).mockResolvedValue(client);

      await clientsController.getById(req, res, next);

      expect(clientsService.getById).toHaveBeenCalledWith("123");
      expect(res.json).toHaveBeenCalledWith(client);
    });

    it("should call next when the service throws an error", async () => {
      const error = new Error("Client not found");

      req.params = { id: "123" };

      vi.mocked(clientsService.getById).mockRejectedValue(error);

      await clientsController.getById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("queryClients", () => {
    it("should search for clients using the request body", async () => {
      const query = {
        email: "john@example.com",
      };

      const clients = [
        {
          id: "123",
          name: "John",
          lastName: "Doe",
          email: "john@example.com",
          shipAddress: "123 Main Street",
          createdAt: new Date(),
        },
      ];

      req.body = query;

      vi.mocked(clientsService.searchClient).mockResolvedValue(clients);

      await clientsController.queryClients(req, res, next);

      expect(clientsService.searchClient).toHaveBeenCalledWith(query);
      expect(res.json).toHaveBeenCalledWith(clients);
      expect(next).not.toHaveBeenCalled();
    });

    it("should use an empty object when the request body is null", async () => {
      req.body = null;

      vi.mocked(clientsService.searchClient).mockResolvedValue([]);

      await clientsController.queryClients(req, res, next);

      expect(clientsService.searchClient).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it("should call next when the service throws an error", async () => {
      const error = new Error("Search failed");

      vi.mocked(clientsService.searchClient).mockRejectedValue(error);

      await clientsController.queryClients(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("should create a client and return status 201", async () => {
      const clientData = {
        name: "John",
        lastName: "Doe",
        email: "john@example.com",
        password: "password123",
        shipAddress: "123 Main Street",
        createdAt: new Date(),
      };

      const createdClient = {
        id: "123",
        ...clientData,
      };

      req.body = clientData;

      vi.mocked(clientsService.create).mockResolvedValue(createdClient);

      await clientsController.create(req, res, next);

      expect(clientsService.create).toHaveBeenCalledWith(clientData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(createdClient);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next when the service throws an error", async () => {
      const error = new Error("Failed to create client");

      vi.mocked(clientsService.create).mockRejectedValue(error);

      await clientsController.create(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe("replace", () => {
    it("should replace a client", async () => {
      const clientData = {
        name: "John",
        lastName: "Smith",
        email: "john@example.com",
        password: "password123",
        shipAddress: "456 New Street",
        createdAt: new Date(),
      };

      const updatedClient = {
        id: "123",
        ...clientData,
      };

      req.params = { id: "123" };
      req.body = clientData;

      vi.mocked(clientsService.replace).mockResolvedValue(updatedClient);

      await clientsController.replace(req, res, next);

      expect(clientsService.replace).toHaveBeenCalledWith("123", clientData);
      expect(res.json).toHaveBeenCalledWith(updatedClient);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next when the service throws an error", async () => {
      const error = new Error("Failed to replace client");

      req.params = { id: "123" };

      vi.mocked(clientsService.replace).mockRejectedValue(error);

      await clientsController.replace(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("patch", () => {
    it("should partially update a client", async () => {
      const clientData = {
        name: "Johnny",
      };

      const updatedClient = {
        id: "123",
        name: "Johnny",
        lastName: "Doe",
        email: "john@example.com",
        password: "password123",
        shipAddress: "123 Main Street",
        createdAt: new Date(),
      };

      req.params = { id: "123" };
      req.body = clientData;

      vi.mocked(clientsService.patch).mockResolvedValue(updatedClient);

      await clientsController.patch(req, res, next);

      expect(clientsService.patch).toHaveBeenCalledWith("123", clientData);
      expect(res.json).toHaveBeenCalledWith(updatedClient);
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next when the service throws an error", async () => {
      const error = new Error("Failed to patch client");

      req.params = { id: "123" };

      vi.mocked(clientsService.patch).mockRejectedValue(error);

      await clientsController.patch(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("delete", () => {
    it("should delete a client and return status 204", async () => {
      req.params = { id: "123" };

      vi.mocked(clientsService.delete).mockResolvedValue(undefined);

      await clientsController.delete(req, res, next);

      expect(clientsService.delete).toHaveBeenCalledWith("123");
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledOnce();
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next when the service throws an error", async () => {
      const error = new Error("Failed to delete client");

      req.params = { id: "123" };

      vi.mocked(clientsService.delete).mockRejectedValue(error);

      await clientsController.delete(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });
  });
});
