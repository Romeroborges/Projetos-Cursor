import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.Executors;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public class Main {
  public static void main(String[] args) throws Exception {
    int port = 8080;
    String portEnv = System.getenv("PORT");
    if (portEnv != null && !portEnv.isBlank()) {
      try {
        port = Integer.parseInt(portEnv.trim());
      } catch (NumberFormatException ignored) {
      }
    }

    Store store = new Store();
    store.seed();

    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/api", new ApiHandler(store));
    server.createContext("/", new StaticHandler("/workspace/java-html/app"));
    server.setExecutor(Executors.newFixedThreadPool(16));

    System.out.println("Bar Clube (Java + HTML) em http://localhost:" + port);
    System.out.println("Login seed: admin@bar.local / admin123");
    server.start();
  }

  // =========================
  // Handlers
  // =========================

  static final class StaticHandler implements HttpHandler {
    private final String rootDir;

    StaticHandler(String rootDir) {
      this.rootDir = rootDir;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
      String path = ex.getRequestURI().getPath();
      if (path.equals("/") || path.isBlank()) {
        redirect(ex, "/index.html");
        return;
      }

      // Basic path traversal protection
      if (path.contains("..")) {
        sendText(ex, 400, "Invalid path");
        return;
      }

      java.nio.file.Path file = java.nio.file.Path.of(rootDir + path);
      if (!java.nio.file.Files.exists(file) || java.nio.file.Files.isDirectory(file)) {
        sendText(ex, 404, "Not found");
        return;
      }

      String ct = contentType(file.toString());
      byte[] bytes = java.nio.file.Files.readAllBytes(file);
      ex.getResponseHeaders().set("Content-Type", ct);
      ex.sendResponseHeaders(200, bytes.length);
      try (OutputStream os = ex.getResponseBody()) {
        os.write(bytes);
      }
    }

    private static String contentType(String file) {
      String f = file.toLowerCase(Locale.ROOT);
      if (f.endsWith(".html")) return "text/html; charset=utf-8";
      if (f.endsWith(".css")) return "text/css; charset=utf-8";
      if (f.endsWith(".js")) return "application/javascript; charset=utf-8";
      if (f.endsWith(".json")) return "application/json; charset=utf-8";
      if (f.endsWith(".svg")) return "image/svg+xml";
      return "application/octet-stream";
    }
  }

  static final class ApiHandler implements HttpHandler {
    private final Store store;

    ApiHandler(Store store) {
      this.store = store;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
      try {
        String path = ex.getRequestURI().getPath();
        String method = ex.getRequestMethod().toUpperCase(Locale.ROOT);

        // /api/...
        String sub = path.startsWith("/api") ? path.substring(4) : path;
        if (sub.isBlank()) sub = "/";

        // Health
        if (method.equals("GET") && (sub.equals("/") || sub.equals("/health"))) {
          sendJson(ex, 200, "{\"ok\":true}");
          return;
        }

        // Auth
        if (method.equals("POST") && sub.equals("/auth/login")) {
          Map<String, String> body = parseForm(readBody(ex));
          String email = body.getOrDefault("email", "").trim();
          String senha = body.getOrDefault("senha", "");
          Auth.LoginResult out = store.authLogin(email, senha);
          if (!out.ok) {
            sendJson(ex, 401, "{\"error\":\"INVALID_CREDENTIALS\"}");
            return;
          }
          sendJson(ex, 200, "{" +
            "\"token\":" + Json.str(out.token) + "," +
            "\"user\":" + out.userJson +
          "}");
          return;
        }

        // Protected endpoints
        User authUser = requireAuth(ex);
        if (authUser == null) return; // response already sent

        // Tables
        if (sub.equals("/tables") && method.equals("GET")) {
          sendJson(ex, 200, store.listTablesJson());
          return;
        }
        if (sub.equals("/tables") && method.equals("POST")) {
          Map<String, String> body = parseForm(readBody(ex));
          String nome = body.getOrDefault("nomeOuNumero", "").trim();
          if (nome.isBlank()) {
            sendJson(ex, 422, "{\"error\":\"VALIDATION_ERROR\"}");
            return;
          }
          sendJson(ex, 201, store.createTableJson(nome));
          return;
        }

        // Products
        if (sub.equals("/products") && method.equals("GET")) {
          sendJson(ex, 200, store.listProductsJson());
          return;
        }
        if (sub.equals("/products") && method.equals("POST")) {
          Map<String, String> body = parseForm(readBody(ex));
          String nome = body.getOrDefault("nome", "").trim();
          String categoria = body.getOrDefault("categoria", "").trim();
          int preco = parseInt(body.get("preco"), -1);
          boolean controla = parseBool(body.get("controleDeEstoque"));
          int qtdAtual = parseInt(body.get("quantidadeAtual"), 0);
          int qtdMin = parseInt(body.get("quantidadeMinima"), 0);

          if (nome.isBlank() || categoria.isBlank() || preco < 0) {
            sendJson(ex, 422, "{\"error\":\"VALIDATION_ERROR\"}");
            return;
          }

          sendJson(ex, 201, store.createProductJson(nome, categoria, preco, controla, qtdAtual, qtdMin));
          return;
        }

        // Cash
        if (sub.equals("/cash/open") && method.equals("GET")) {
          sendJson(ex, 200, store.getOpenCashJson());
          return;
        }
        if (sub.equals("/cash/open") && method.equals("POST")) {
          Map<String, String> body = parseForm(readBody(ex));
          int valorInicial = parseInt(body.get("valorInicial"), -1);
          if (valorInicial < 0) {
            sendJson(ex, 422, "{\"error\":\"VALIDATION_ERROR\"}");
            return;
          }
          Store.Result r = store.openCash(authUser.id, valorInicial);
          sendJson(ex, r.status, r.json);
          return;
        }
        if (sub.equals("/cash/adjust") && method.equals("POST")) {
          Map<String, String> body = parseForm(readBody(ex));
          String type = body.getOrDefault("type", "").trim();
          int valor = parseInt(body.get("valor"), -1);
          String motivo = body.getOrDefault("motivo", "");
          if (!(type.equals("SANGRIA") || type.equals("REFORCO")) || valor <= 0) {
            sendJson(ex, 422, "{\"error\":\"VALIDATION_ERROR\"}");
            return;
          }
          Store.Result r = store.cashAdjust(authUser.id, type, valor, motivo);
          sendJson(ex, r.status, r.json);
          return;
        }
        if (sub.equals("/cash/close") && method.equals("POST")) {
          Map<String, String> body = parseForm(readBody(ex));
          int valorFinal = parseInt(body.get("valorFinal"), -1);
          if (valorFinal < 0) {
            sendJson(ex, 422, "{\"error\":\"VALIDATION_ERROR\"}");
            return;
          }
          Store.Result r = store.closeCash(authUser.id, valorFinal);
          sendJson(ex, r.status, r.json);
          return;
        }

        // Orders
        if (sub.equals("/orders") && method.equals("GET")) {
          Map<String, String> q = parseQuery(ex.getRequestURI());
          Store.Result r = store.listOrdersJson(q.get("status"), q.get("tableId"), q.get("cliente"));
          sendJson(ex, r.status, r.json);
          return;
        }
        if (sub.equals("/orders") && method.equals("POST")) {
          Map<String, String> body = parseForm(readBody(ex));
          String tipo = body.getOrDefault("tipoIdentificacao", "").trim();
          String tableId = body.get("tableId");
          String nomeCliente = body.get("nomeCliente");
          Store.Result r = store.openOrder(authUser.id, tipo, tableId, nomeCliente);
          sendJson(ex, r.status, r.json);
          return;
        }

        // /orders/{id}
        if (sub.startsWith("/orders/") && method.equals("GET")) {
          String[] parts = sub.split("/");
          if (parts.length == 3) {
            String orderId = parts[2];
            Store.Result r = store.getOrderById(orderId);
            sendJson(ex, r.status, r.json);
            return;
          }
        }

        // /orders/{id}/items
        if (sub.matches("^/orders/[^/]+/items$") && method.equals("POST")) {
          String orderId = sub.split("/")[2];
          Map<String, String> body = parseForm(readBody(ex));
          String productId = body.getOrDefault("productId", "").trim();
          int quantidade = parseInt(body.get("quantidade"), -1);
          String obs = body.get("observacao");
          Store.Result r = store.addOrderItem(authUser.id, orderId, productId, quantidade, obs);
          sendJson(ex, r.status, r.json);
          return;
        }

        // /orders/{id}/payments
        if (sub.matches("^/orders/[^/]+/payments$") && method.equals("POST")) {
          String orderId = sub.split("/")[2];
          Map<String, String> body = parseForm(readBody(ex));
          String metodo = body.getOrDefault("metodo", "").trim();
          int valor = parseInt(body.get("valor"), -1);
          Store.Result r = store.addPayment(authUser.id, orderId, metodo, valor);
          sendJson(ex, r.status, r.json);
          return;
        }

        // /orders/{id}/close
        if (sub.matches("^/orders/[^/]+/close$") && method.equals("POST")) {
          String orderId = sub.split("/")[2];
          Store.Result r = store.closeOrder(authUser.id, orderId);
          sendJson(ex, r.status, r.json);
          return;
        }

        sendJson(ex, 404, "{\"error\":\"NOT_FOUND\"}");
      } catch (Exception e) {
        e.printStackTrace();
        sendJson(ex, 500, "{\"error\":\"INTERNAL_ERROR\"}");
      }
    }

    private User requireAuth(HttpExchange ex) throws IOException {
      String header = ex.getRequestHeaders().getFirst("Authorization");
      if (header == null || !header.startsWith("Bearer ")) {
        sendJson(ex, 401, "{\"error\":\"UNAUTHORIZED\"}");
        return null;
      }
      String token = header.substring("Bearer ".length()).trim();
      User u = store.authFromToken(token);
      if (u == null) {
        sendJson(ex, 401, "{\"error\":\"UNAUTHORIZED\"}");
        return null;
      }
      return u;
    }
  }

  // =========================
  // Store / Domain
  // =========================

  static final class Store {
    private final Object lock = new Object();
    private final SecureRandom rnd = new SecureRandom();

    private final Map<String, User> usersById = new HashMap<>();
    private final Map<String, User> usersByEmail = new HashMap<>();

    private final Map<String, String> tokenToUserId = new HashMap<>();

    private final Map<String, Table> tables = new HashMap<>();
    private final Map<String, Product> products = new HashMap<>();
    private final Map<String, Order> orders = new HashMap<>();

    private CashRegister openCash;

    void seed() {
      synchronized (lock) {
        if (usersByEmail.containsKey("admin@bar.local")) return;

        User admin = User.create("Admin", "admin@bar.local", "ADMIN", "admin123");
        usersById.put(admin.id, admin);
        usersByEmail.put(admin.email, admin);

        for (int i = 1; i <= 12; i++) {
          Table t = new Table(uuid(), String.valueOf(i), "LIVRE");
          tables.put(t.id, t);
        }

        Product cerveja = new Product(uuid(), "Cerveja Lata", "Bebidas", 800, true, 100, 10, true);
        Product refri = new Product(uuid(), "Refrigerante", "Bebidas", 600, true, 80, 10, true);
        Product batata = new Product(uuid(), "Porção Batata", "Cozinha", 2500, false, 0, 0, true);
        products.put(cerveja.id, cerveja);
        products.put(refri.id, refri);
        products.put(batata.id, batata);
      }
    }

    static final class Result {
      final int status;
      final String json;

      Result(int status, String json) {
        this.status = status;
        this.json = json;
      }
    }

    Auth.LoginResult authLogin(String email, String senha) {
      synchronized (lock) {
        User u = usersByEmail.get(email.toLowerCase(Locale.ROOT));
        if (u == null || !u.ativo) return Auth.LoginResult.fail();
        if (!Auth.verifyPassword(senha, u.salt, u.passwordHash)) return Auth.LoginResult.fail();

        String token = Auth.newToken();
        tokenToUserId.put(token, u.id);

        String userJson = "{" +
          "\"id\":" + Json.str(u.id) + "," +
          "\"nome\":" + Json.str(u.nome) + "," +
          "\"email\":" + Json.str(u.email) + "," +
          "\"papel\":" + Json.str(u.role) +
        "}";

        return Auth.LoginResult.ok(token, userJson);
      }
    }

    User authFromToken(String token) {
      synchronized (lock) {
        String userId = tokenToUserId.get(token);
        if (userId == null) return null;
        return usersById.get(userId);
      }
    }

    String listTablesJson() {
      synchronized (lock) {
        List<Table> list = new ArrayList<>(tables.values());
        list.sort(Comparator.comparing(t -> t.nomeOuNumero));
        StringBuilder sb = new StringBuilder();
        sb.append('[');
        for (int i = 0; i < list.size(); i++) {
          if (i > 0) sb.append(',');
          Table t = list.get(i);
          sb.append("{");
          sb.append("\"id\":").append(Json.str(t.id)).append(',');
          sb.append("\"nomeOuNumero\":").append(Json.str(t.nomeOuNumero)).append(',');
          sb.append("\"status\":").append(Json.str(t.status));
          sb.append("}");
        }
        sb.append(']');
        return sb.toString();
      }
    }

    String createTableJson(String nomeOuNumero) {
      synchronized (lock) {
        for (Table t : tables.values()) {
          if (t.nomeOuNumero.equalsIgnoreCase(nomeOuNumero)) {
            return "{\"error\":\"TABLE_ALREADY_EXISTS\"}";
          }
        }
        Table t = new Table(uuid(), nomeOuNumero, "LIVRE");
        tables.put(t.id, t);
        return "{" +
          "\"id\":" + Json.str(t.id) + "," +
          "\"nomeOuNumero\":" + Json.str(t.nomeOuNumero) + "," +
          "\"status\":" + Json.str(t.status) +
        "}";
      }
    }

    String listProductsJson() {
      synchronized (lock) {
        List<Product> list = new ArrayList<>(products.values());
        list.sort(Comparator.comparing(p -> p.categoria + "-" + p.nome));
        StringBuilder sb = new StringBuilder();
        sb.append('[');
        for (int i = 0; i < list.size(); i++) {
          if (i > 0) sb.append(',');
          Product p = list.get(i);
          sb.append(p.toJson());
        }
        sb.append(']');
        return sb.toString();
      }
    }

    String createProductJson(String nome, String categoria, int preco, boolean controla, int qtdAtual, int qtdMin) {
      synchronized (lock) {
        Product p = new Product(uuid(), nome, categoria, preco, controla, controla ? qtdAtual : 0, controla ? qtdMin : 0, true);
        products.put(p.id, p);
        return p.toJson();
      }
    }

    String getOpenCashJson() {
      synchronized (lock) {
        return openCash == null ? "null" : openCash.toJson();
      }
    }

    Result openCash(String userId, int valorInicial) {
      synchronized (lock) {
        if (openCash != null) return new Result(409, "{\"error\":\"CASH_REGISTER_ALREADY_OPEN\"}");
        openCash = new CashRegister(uuid(), userId, Instant.now(), valorInicial);
        return new Result(201, openCash.toJson());
      }
    }

    Result cashAdjust(String userId, String type, int valor, String motivo) {
      synchronized (lock) {
        if (openCash == null) return new Result(409, "{\"error\":\"NO_OPEN_CASH_REGISTER\"}");
        openCash.movements.add(new CashMovement(uuid(), userId, type, valor, motivo, Instant.now()));
        return new Result(200, "{\"ok\":true}");
      }
    }

    Result closeCash(String userId, int valorFinal) {
      synchronized (lock) {
        if (openCash == null) return new Result(409, "{\"error\":\"NO_OPEN_CASH_REGISTER\"}");

        int totalPayments = 0;
        for (Order o : orders.values()) {
          if (o.fechadoEm != null && !o.fechadoEm.isBefore(openCash.abertoEm)) {
            for (Payment p : o.pagamentos) totalPayments += p.valor;
          }
        }

        int movementsNet = 0;
        for (CashMovement m : openCash.movements) {
          movementsNet += m.type.equals("REFORCO") ? m.valor : -m.valor;
        }

        int expected = openCash.valorInicial + totalPayments + movementsNet;
        int diff = valorFinal - expected;

        openCash.status = "FECHADO";
        openCash.fechadoEm = Instant.now();
        openCash.valorFinal = valorFinal;

        String out = "{" +
          "\"cash\":" + openCash.toJson() + "," +
          "\"expected\":" + expected + "," +
          "\"diff\":" + diff + 
        "}";

        openCash = null;
        return new Result(200, out);
      }
    }

    Result openOrder(String userId, String tipo, String tableId, String nomeCliente) {
      synchronized (lock) {
        if (openCash == null) return new Result(409, "{\"error\":\"CASH_REGISTER_MUST_BE_OPEN\"}");

        if (!("MESA".equals(tipo) || "CLIENTE".equals(tipo))) {
          return new Result(422, "{\"error\":\"ORDER_IDENTIFICATION_REQUIRED\"}");
        }

        if ("MESA".equals(tipo)) {
          if (tableId == null || tableId.isBlank()) return new Result(422, "{\"error\":\"ORDER_IDENTIFICATION_REQUIRED\"}");
          Table t = tables.get(tableId);
          if (t == null) return new Result(404, "{\"error\":\"TABLE_NOT_FOUND\"}");
          if (!"LIVRE".equals(t.status)) return new Result(409, "{\"error\":\"TABLE_NOT_AVAILABLE\"}");
        }

        if ("CLIENTE".equals(tipo)) {
          if (nomeCliente == null || nomeCliente.trim().isBlank()) return new Result(422, "{\"error\":\"ORDER_IDENTIFICATION_REQUIRED\"}");
        }

        Order o = new Order(uuid(), tipo, "ABERTO", userId, Instant.now());
        if ("MESA".equals(tipo)) {
          o.tableId = tableId;
          o.nomeCliente = null;
          tables.get(tableId).status = "OCUPADO";
        } else {
          o.tableId = null;
          o.nomeCliente = nomeCliente.trim();
        }

        orders.put(o.id, o);
        return new Result(201, o.toJson(this));
      }
    }

    Result listOrdersJson(String status, String tableId, String cliente) {
      synchronized (lock) {
        List<Order> list = new ArrayList<>(orders.values());
        list.sort((a, b) -> b.abertoEm.compareTo(a.abertoEm));

        StringBuilder sb = new StringBuilder();
        sb.append('[');
        boolean first = true;
        for (Order o : list) {
          if (status != null && !status.isBlank() && !status.equals(o.status)) continue;
          if (tableId != null && !tableId.isBlank() && (o.tableId == null || !o.tableId.equals(tableId))) continue;
          if (cliente != null && !cliente.isBlank()) {
            String nc = o.nomeCliente == null ? "" : o.nomeCliente;
            if (!nc.toLowerCase(Locale.ROOT).contains(cliente.toLowerCase(Locale.ROOT))) continue;
          }

          if (!first) sb.append(',');
          first = false;
          sb.append(o.toJsonSummary(this));
        }
        sb.append(']');
        return new Result(200, sb.toString());
      }
    }

    Result getOrderById(String orderId) {
      synchronized (lock) {
        Order o = orders.get(orderId);
        if (o == null) return new Result(404, "{\"error\":\"ORDER_NOT_FOUND\"}");
        return new Result(200, o.toJson(this));
      }
    }

    Result addOrderItem(String userId, String orderId, String productId, int quantidade, String observacao) {
      synchronized (lock) {
        Order o = orders.get(orderId);
        if (o == null) return new Result(404, "{\"error\":\"ORDER_NOT_FOUND\"}");
        if ("FECHADO".equals(o.status)) return new Result(409, "{\"error\":\"ORDER_ALREADY_CLOSED\"}");
        if (quantidade <= 0) return new Result(422, "{\"error\":\"INVALID_QUANTITY\"}");

        Product p = products.get(productId);
        if (p == null || !p.ativo) return new Result(404, "{\"error\":\"PRODUCT_NOT_FOUND\"}");

        if (p.controlaEstoque) {
          if (p.estoqueAtual < quantidade) return new Result(409, "{\"error\":\"INSUFFICIENT_STOCK\"}");
          p.estoqueAtual -= quantidade;
        }

        int unit = p.preco;
        int total = unit * quantidade;
        OrderItem it = new OrderItem(uuid(), productId, quantidade, observacao, unit, total, Instant.now());
        o.itens.add(it);
        o.valorTotal += total;
        if (!"EM_ANDAMENTO".equals(o.status)) o.status = "EM_ANDAMENTO";

        return new Result(201, it.toJson(this));
      }
    }

    Result addPayment(String userId, String orderId, String metodo, int valor) {
      synchronized (lock) {
        Order o = orders.get(orderId);
        if (o == null) return new Result(404, "{\"error\":\"ORDER_NOT_FOUND\"}");
        if ("FECHADO".equals(o.status)) return new Result(409, "{\"error\":\"ORDER_ALREADY_CLOSED\"}");
        if (!(metodo.equals("CREDITO") || metodo.equals("DEBITO") || metodo.equals("PIX") || metodo.equals("DINHEIRO"))) {
          return new Result(422, "{\"error\":\"VALIDATION_ERROR\"}");
        }
        if (valor <= 0) return new Result(422, "{\"error\":\"INVALID_AMOUNT\"}");

        Payment p = new Payment(uuid(), metodo, valor, Instant.now());
        o.pagamentos.add(p);
        return new Result(201, p.toJson());
      }
    }

    Result closeOrder(String userId, String orderId) {
      synchronized (lock) {
        if (openCash == null) return new Result(409, "{\"error\":\"CASH_REGISTER_MUST_BE_OPEN\"}");

        Order o = orders.get(orderId);
        if (o == null) return new Result(404, "{\"error\":\"ORDER_NOT_FOUND\"}");
        if ("FECHADO".equals(o.status)) return new Result(409, "{\"error\":\"ORDER_ALREADY_CLOSED\"}");
        if (o.itens.isEmpty()) return new Result(409, "{\"error\":\"ORDER_HAS_NO_ITEMS\"}");

        int paid = 0;
        for (Payment p : o.pagamentos) paid += p.valor;
        if (paid < o.valorTotal) return new Result(409, "{\"error\":\"INSUFFICIENT_PAYMENT\"}");

        o.status = "FECHADO";
        o.fechadoEm = Instant.now();
        if (o.tableId != null) {
          Table t = tables.get(o.tableId);
          if (t != null) t.status = "LIVRE";
        }

        return new Result(200, o.toJson(this));
      }
    }

    private String uuid() {
      return UUID.randomUUID().toString();
    }
  }

  static final class User {
    final String id;
    final String nome;
    final String email;
    final String role;
    final boolean ativo;
    final byte[] salt;
    final byte[] passwordHash;

    User(String id, String nome, String email, String role, boolean ativo, byte[] salt, byte[] passwordHash) {
      this.id = id;
      this.nome = nome;
      this.email = email;
      this.role = role;
      this.ativo = ativo;
      this.salt = salt;
      this.passwordHash = passwordHash;
    }

    static User create(String nome, String email, String role, String senha) {
      String id = UUID.randomUUID().toString();
      byte[] salt = Auth.newSalt();
      byte[] hash = Auth.hashPassword(senha, salt);
      return new User(id, nome, email.toLowerCase(Locale.ROOT), role, true, salt, hash);
    }
  }

  static final class Table {
    final String id;
    final String nomeOuNumero;
    String status;

    Table(String id, String nomeOuNumero, String status) {
      this.id = id;
      this.nomeOuNumero = nomeOuNumero;
      this.status = status;
    }
  }

  static final class Product {
    final String id;
    final String nome;
    final String categoria;
    final int preco; // cents
    final boolean controlaEstoque;
    int estoqueAtual;
    int estoqueMinimo;
    final boolean ativo;

    Product(String id, String nome, String categoria, int preco, boolean controlaEstoque, int estoqueAtual, int estoqueMinimo, boolean ativo) {
      this.id = id;
      this.nome = nome;
      this.categoria = categoria;
      this.preco = preco;
      this.controlaEstoque = controlaEstoque;
      this.estoqueAtual = estoqueAtual;
      this.estoqueMinimo = estoqueMinimo;
      this.ativo = ativo;
    }

    String toJson() {
      String estoqueJson = controlaEstoque
        ? ("{\"quantidadeAtual\":" + estoqueAtual + ",\"quantidadeMinima\":" + estoqueMinimo + "}")
        : "null";

      return "{" +
        "\"id\":" + Json.str(id) + "," +
        "\"nome\":" + Json.str(nome) + "," +
        "\"categoria\":" + Json.str(categoria) + "," +
        "\"preco\":" + preco + "," +
        "\"controlaEstoque\":" + controlaEstoque + "," +
        "\"ativo\":" + ativo + "," +
        "\"estoque\":" + estoqueJson +
      "}";
    }
  }

  static final class Order {
    final String id;
    final String tipoIdentificacao; // MESA | CLIENTE
    String status; // ABERTO | EM_ANDAMENTO | FECHADO
    String tableId;
    String nomeCliente;
    final String abertoPorId;
    final Instant abertoEm;
    Instant fechadoEm;
    int valorTotal;

    final List<OrderItem> itens = new ArrayList<>();
    final List<Payment> pagamentos = new ArrayList<>();

    Order(String id, String tipoIdentificacao, String status, String abertoPorId, Instant abertoEm) {
      this.id = id;
      this.tipoIdentificacao = tipoIdentificacao;
      this.status = status;
      this.abertoPorId = abertoPorId;
      this.abertoEm = abertoEm;
      this.valorTotal = 0;
    }

    String toJsonSummary(Store store) {
      String tableJson = "null";
      if (tableId != null) {
        Table t = store.tables.get(tableId);
        if (t != null) {
          tableJson = "{\"id\":" + Json.str(t.id) + ",\"nomeOuNumero\":" + Json.str(t.nomeOuNumero) + "}";
        }
      }

      return "{" +
        "\"id\":" + Json.str(id) + "," +
        "\"status\":" + Json.str(status) + "," +
        "\"tipoIdentificacao\":" + Json.str(tipoIdentificacao) + "," +
        "\"tableId\":" + (tableId == null ? "null" : Json.str(tableId)) + "," +
        "\"nomeCliente\":" + (nomeCliente == null ? "null" : Json.str(nomeCliente)) + "," +
        "\"abertoEm\":" + Json.str(abertoEm.toString()) + "," +
        "\"fechadoEm\":" + (fechadoEm == null ? "null" : Json.str(fechadoEm.toString())) + "," +
        "\"valorTotal\":" + valorTotal + "," +
        "\"table\":" + tableJson +
      "}";
    }

    String toJson(Store store) {
      StringBuilder items = new StringBuilder();
      items.append('[');
      for (int i = 0; i < itens.size(); i++) {
        if (i > 0) items.append(',');
        items.append(itens.get(i).toJson(store));
      }
      items.append(']');

      StringBuilder pays = new StringBuilder();
      pays.append('[');
      for (int i = 0; i < pagamentos.size(); i++) {
        if (i > 0) pays.append(',');
        pays.append(pagamentos.get(i).toJson());
      }
      pays.append(']');

      String tableJson = "null";
      if (tableId != null) {
        Table t = store.tables.get(tableId);
        if (t != null) {
          tableJson = "{\"id\":" + Json.str(t.id) + ",\"nomeOuNumero\":" + Json.str(t.nomeOuNumero) + "}";
        }
      }

      return "{" +
        "\"id\":" + Json.str(id) + "," +
        "\"status\":" + Json.str(status) + "," +
        "\"tipoIdentificacao\":" + Json.str(tipoIdentificacao) + "," +
        "\"nomeCliente\":" + (nomeCliente == null ? "null" : Json.str(nomeCliente)) + "," +
        "\"table\":" + tableJson + "," +
        "\"valorTotal\":" + valorTotal + "," +
        "\"itens\":" + items + "," +
        "\"pagamentos\":" + pays +
      "}";
    }
  }

  static final class OrderItem {
    final String id;
    final String productId;
    final int quantidade;
    final String observacao;
    final int precoUnitario;
    final int precoTotal;
    final Instant criadoEm;

    OrderItem(String id, String productId, int quantidade, String observacao, int precoUnitario, int precoTotal, Instant criadoEm) {
      this.id = id;
      this.productId = productId;
      this.quantidade = quantidade;
      this.observacao = observacao;
      this.precoUnitario = precoUnitario;
      this.precoTotal = precoTotal;
      this.criadoEm = criadoEm;
    }

    String toJson(Store store) {
      Product p = store.products.get(productId);
      String prodJson = p == null
        ? ("{\"id\":" + Json.str(productId) + ",\"nome\":\"?\",\"categoria\":\"?\"}")
        : ("{\"id\":" + Json.str(p.id) + ",\"nome\":" + Json.str(p.nome) + ",\"categoria\":" + Json.str(p.categoria) + "}");

      return "{" +
        "\"id\":" + Json.str(id) + "," +
        "\"quantidade\":" + quantidade + "," +
        "\"observacao\":" + (observacao == null || observacao.isBlank() ? "null" : Json.str(observacao)) + "," +
        "\"precoUnitario\":" + precoUnitario + "," +
        "\"precoTotal\":" + precoTotal + "," +
        "\"criadoEm\":" + Json.str(criadoEm.toString()) + "," +
        "\"canceladoEm\":null," +
        "\"product\":" + prodJson +
      "}";
    }
  }

  static final class Payment {
    final String id;
    final String metodo;
    final int valor;
    final Instant pagoEm;

    Payment(String id, String metodo, int valor, Instant pagoEm) {
      this.id = id;
      this.metodo = metodo;
      this.valor = valor;
      this.pagoEm = pagoEm;
    }

    String toJson() {
      return "{" +
        "\"id\":" + Json.str(id) + "," +
        "\"metodo\":" + Json.str(metodo) + "," +
        "\"valor\":" + valor + "," +
        "\"pagoEm\":" + Json.str(pagoEm.toString()) +
      "}";
    }
  }

  static final class CashRegister {
    final String id;
    String status;
    final String abertoPorId;
    final Instant abertoEm;
    Instant fechadoEm;
    final int valorInicial;
    Integer valorFinal;
    final List<CashMovement> movements = new ArrayList<>();

    CashRegister(String id, String abertoPorId, Instant abertoEm, int valorInicial) {
      this.id = id;
      this.abertoPorId = abertoPorId;
      this.abertoEm = abertoEm;
      this.valorInicial = valorInicial;
      this.status = "ABERTO";
    }

    String toJson() {
      return "{" +
        "\"id\":" + Json.str(id) + "," +
        "\"status\":" + Json.str(status) + "," +
        "\"abertoEm\":" + Json.str(abertoEm.toString()) + "," +
        "\"fechadoEm\":" + (fechadoEm == null ? "null" : Json.str(fechadoEm.toString())) + "," +
        "\"valorInicial\":" + valorInicial + "," +
        "\"valorFinal\":" + (valorFinal == null ? "null" : String.valueOf(valorFinal)) +
      "}";
    }
  }

  static final class CashMovement {
    final String id;
    final String userId;
    final String type;
    final int valor;
    final String motivo;
    final Instant criadoEm;

    CashMovement(String id, String userId, String type, int valor, String motivo, Instant criadoEm) {
      this.id = id;
      this.userId = userId;
      this.type = type;
      this.valor = valor;
      this.motivo = motivo;
      this.criadoEm = criadoEm;
    }
  }

  // =========================
  // Auth helpers (PBKDF2 + token)
  // =========================

  static final class Auth {
    private static final SecureRandom RND = new SecureRandom();

    static byte[] newSalt() {
      byte[] salt = new byte[16];
      RND.nextBytes(salt);
      return salt;
    }

    static byte[] hashPassword(String password, byte[] salt) {
      try {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 120_000, 256);
        SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        return skf.generateSecret(spec).getEncoded();
      } catch (Exception e) {
        throw new RuntimeException(e);
      }
    }

    static boolean verifyPassword(String password, byte[] salt, byte[] expectedHash) {
      byte[] got = hashPassword(password, salt);
      return constantTimeEquals(got, expectedHash);
    }

    static String newToken() {
      byte[] b = new byte[32];
      RND.nextBytes(b);
      return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    static boolean constantTimeEquals(byte[] a, byte[] b) {
      if (a == null || b == null) return false;
      if (a.length != b.length) return false;
      int r = 0;
      for (int i = 0; i < a.length; i++) r |= (a[i] ^ b[i]);
      return r == 0;
    }

    static final class LoginResult {
      final boolean ok;
      final String token;
      final String userJson;

      LoginResult(boolean ok, String token, String userJson) {
        this.ok = ok;
        this.token = token;
        this.userJson = userJson;
      }

      static LoginResult ok(String token, String userJson) {
        return new LoginResult(true, token, userJson);
      }

      static LoginResult fail() {
        return new LoginResult(false, null, null);
      }
    }
  }

  // =========================
  // JSON helpers (minimal)
  // =========================

  static final class Json {
    static String str(String s) {
      if (s == null) return "null";
      StringBuilder sb = new StringBuilder();
      sb.append('"');
      for (int i = 0; i < s.length(); i++) {
        char c = s.charAt(i);
        switch (c) {
          case '\\' -> sb.append("\\\\");
          case '"' -> sb.append("\\\"");
          case '\n' -> sb.append("\\n");
          case '\r' -> sb.append("\\r");
          case '\t' -> sb.append("\\t");
          default -> {
            if (c < 32) sb.append(String.format("\\u%04x", (int) c));
            else sb.append(c);
          }
        }
      }
      sb.append('"');
      return sb.toString();
    }
  }

  // =========================
  // HTTP helpers
  // =========================

  static String readBody(HttpExchange ex) throws IOException {
    try (InputStream is = ex.getRequestBody()) {
      return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  static void sendJson(HttpExchange ex, int status, String json) throws IOException {
    byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
    Headers h = ex.getResponseHeaders();
    h.set("Content-Type", "application/json; charset=utf-8");
    h.set("Cache-Control", "no-store");
    ex.sendResponseHeaders(status, bytes.length);
    try (OutputStream os = ex.getResponseBody()) {
      os.write(bytes);
    }
  }

  static void sendText(HttpExchange ex, int status, String text) throws IOException {
    byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
    ex.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
    ex.sendResponseHeaders(status, bytes.length);
    try (OutputStream os = ex.getResponseBody()) {
      os.write(bytes);
    }
  }

  static void redirect(HttpExchange ex, String to) throws IOException {
    ex.getResponseHeaders().set("Location", to);
    ex.sendResponseHeaders(302, -1);
    ex.close();
  }

  static Map<String, String> parseForm(String body) {
    return parseQueryString(body);
  }

  static Map<String, String> parseQuery(URI uri) {
    String q = uri.getRawQuery();
    if (q == null) return new HashMap<>();
    return parseQueryString(q);
  }

  static Map<String, String> parseQueryString(String s) {
    Map<String, String> out = new HashMap<>();
    if (s == null || s.isBlank()) return out;
    String[] parts = s.split("&");
    for (String p : parts) {
      if (p.isBlank()) continue;
      int i = p.indexOf('=');
      String k = i >= 0 ? p.substring(0, i) : p;
      String v = i >= 0 ? p.substring(i + 1) : "";
      out.put(urlDecode(k), urlDecode(v));
    }
    return out;
  }

  static String urlDecode(String s) {
    try {
      return URLDecoder.decode(s, StandardCharsets.UTF_8);
    } catch (Exception e) {
      return s;
    }
  }

  static int parseInt(String s, int def) {
    if (s == null) return def;
    try {
      return Integer.parseInt(s.trim());
    } catch (Exception e) {
      return def;
    }
  }

  static boolean parseBool(String s) {
    if (s == null) return false;
    String v = s.trim().toLowerCase(Locale.ROOT);
    return v.equals("true") || v.equals("1") || v.equals("on") || v.equals("yes");
  }
}
