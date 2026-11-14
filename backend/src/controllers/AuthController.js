export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  login = async (req, res) => {
    try {
      const { username, password } = req.body;
      const session = await this.authService.login(username, password);
      res.json({ success: true, data: session });
    } catch (err) {
      res.status(401).json({ success: false, message: err.message });
    }
  };

  getClients = async (req, res) => {
    try {
      const clients = await this.authService.getClients(req.user);
      res.json({ success: true, data: clients });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  createClient = async (req, res) => {
    try {
      const result = await this.authService.createClient(req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  getUsers = async (req, res) => {
    try {
      const users = await this.authService.getUsers(req.user);
      res.json({ success: true, data: users });
    } catch (err) {
      res.status(403).json({ success: false, message: err.message });
    }
  };

  createUser = async (req, res) => {
    try {
      const result = await this.authService.createUser(req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  getAssignments = async (req, res) => {
    try {
      const data = await this.authService.getAssignments(req.user);
      res.json({ success: true, data });
    } catch (err) {
      res.status(403).json({ success: false, message: err.message });
    }
  };

  createAssignment = async (req, res) => {
    try {
      const result = await this.authService.createAssignment(req.body, req.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  deleteAssignment = async (req, res) => {
    try {
      const result = await this.authService.deleteAssignment(req.params.id, req.user);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  };
}
