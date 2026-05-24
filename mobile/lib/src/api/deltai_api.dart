import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../config/app_config.dart';
import '../models/models.dart';

class DeltaIApi {
  DeltaIApi({required this.prefs, this.baseUrl = AppConfig.apiBaseUrl});

  final SharedPreferences prefs;
  final String baseUrl;

  String? get token => prefs.getString('delt_token');

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Future<Map<String, dynamic>> _json(http.Response res) async {
    final data = res.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(data['error'] ?? res.reasonPhrase ?? 'Erreur API');
    }
    return data;
  }

  Future<DeltUser?> restore() async {
    if (token == null) return null;
    try {
      final res = await http.get(_uri('/api/auth/me'), headers: _headers);
      return DeltUser.fromJson(await _json(res));
    } catch (_) {
      return null;
    }
  }

  Future<DeltUser> login(String email, String password) async {
    final res = await http.post(
      _uri('/api/auth/login'),
      headers: _headers,
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = await _json(res);
    await prefs.setString('delt_token', '${data['token']}');
    return DeltUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<DeltUser> register(String email, String password) async {
    final res = await http.post(
      _uri('/api/auth/register'),
      headers: _headers,
      body: jsonEncode({
        'email': email,
        'password': password,
        'termsAccepted': true,
        'privacyAccepted': true,
      }),
    );
    final data = await _json(res);
    await prefs.setString('delt_token', '${data['token']}');
    return DeltUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<DeltUser> googleAuth(
    String supabaseAccessToken, {
    required bool legalAccepted,
  }) async {
    final res = await http.post(
      _uri('/api/auth/google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'accessToken': supabaseAccessToken,
        'termsAccepted': legalAccepted,
        'privacyAccepted': legalAccepted,
      }),
    );
    final data = await _json(res);
    await prefs.setString('delt_token', '${data['token']}');
    return DeltUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<void> logout() => prefs.remove('delt_token');

  Future<num> quota() async {
    final data = await quotaDetails();
    return data['credits'] is num ? data['credits'] as num : 0;
  }

  Future<Map<String, dynamic>> quotaDetails() async {
    final res = await http.get(_uri('/api/quota'), headers: _headers);
    return _json(res);
  }

  Future<Map<String, dynamic>> memory() async {
    final res = await http.get(_uri('/api/memory'), headers: _headers);
    return _json(res);
  }

  Future<void> setMemory({
    required String? displayName,
    required Map<String, dynamic> profile,
  }) async {
    final res = await http.put(
      _uri('/api/memory'),
      headers: _headers,
      body: jsonEncode({'displayName': displayName, 'profile': profile}),
    );
    await _json(res);
  }

  Future<List<DeltProject>> projects() async {
    final res = await http.get(_uri('/api/projects'), headers: _headers);
    final data = await _json(res);
    final list = data['projects'] as List? ?? const [];
    return list
        .map((e) => DeltProject.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<DeltProject> createProject(String name) async {
    final res = await http.post(
      _uri('/api/projects'),
      headers: _headers,
      body: jsonEncode({'name': name, 'icon': '📁', 'color': '#6366f1'}),
    );
    return DeltProject.fromJson(await _json(res));
  }

  Future<List<DeltConversation>> conversations() async {
    final res = await http.get(_uri('/api/conversations'), headers: _headers);
    final data = await _json(res);
    final list = data['conversations'] as List? ?? const [];
    return list
        .map((e) => DeltConversation.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<ChatMessage>> conversation(String id) async {
    final res = await http.get(
      _uri('/api/conversations/$id'),
      headers: _headers,
    );
    final data = await _json(res);
    final list = data['messages'] as List? ?? const [];
    return list
        .map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> saveConversation(
    String id,
    List<ChatMessage> messages,
    String? projectId,
  ) async {
    final body = <String, dynamic>{
      'messages': messages.map((m) => m.toJson()).toList(),
    };
    if (projectId != null) {
      body['projectId'] = projectId;
    }
    await http.put(
      _uri('/api/conversations/$id'),
      headers: _headers,
      body: jsonEncode(body),
    );
  }

  Future<List<DeltModel>> catalog() async {
    final res = await http.get(_uri('/api/catalog'), headers: _headers);
    final data = await _json(res);
    final categories = data['categories'] as Map<String, dynamic>? ?? {};
    final models = <DeltModel>[];
    for (final entry in categories.entries) {
      final cat = entry.value as Map<String, dynamic>;
      final cost = cat['cost'] is num ? cat['cost'] as num : 0;
      for (final model in cat['models'] as List? ?? const []) {
        models.add(
          DeltModel.fromJson(entry.key, cost, model as Map<String, dynamic>),
        );
      }
    }
    return models;
  }

  /// Modèles de génération d'image (FLUX, Nano Banana, GPT Image…)
  Future<List<DeltImageModel>> imageModels() async {
    final res = await http.get(_uri('/api/catalog'), headers: _headers);
    final data = await _json(res);
    final imgs = (data['creative']?['IMAGE']?['models'] as List?) ?? const [];
    return imgs
        .whereType<Map<String, dynamic>>()
        .map(DeltImageModel.fromJson)
        .toList();
  }

  /// Génère une image. Renvoie { url, model, prompt, cost }
  Future<Map<String, dynamic>> generateImage({
    required String prompt,
    required String modelId,
  }) async {
    final res = await http.post(
      _uri('/api/image'),
      headers: _headers,
      body: jsonEncode({'prompt': prompt, 'modelId': modelId}),
    );
    return _json(res);
  }

  Future<Map<String, String>> modelPreferences() async {
    final res = await http.get(
      _uri('/api/preferences/models'),
      headers: _headers,
    );
    final data = await _json(res);
    final prefs = data['preferences'] as Map<String, dynamic>? ?? {};
    return prefs.map((key, value) => MapEntry(key, '$value'));
  }

  Future<void> setModelPreferences(Map<String, String> preferences) async {
    final res = await http.put(
      _uri('/api/preferences/models'),
      headers: _headers,
      body: jsonEncode({'preferences': preferences}),
    );
    await _json(res);
  }

  Future<Map<String, dynamic>> route(String message) async {
    final res = await http.post(
      _uri('/api/route'),
      headers: _headers,
      body: jsonEncode({'message': message}),
    );
    return _json(res);
  }

  Future<void> chatStream({
    required List<ChatMessage> messages,
    DeltModel? model,
    required String tier,
    required bool manual,
    String? projectId,
    required void Function(String delta) onDelta,
    void Function(String delta)? onThinking,
    required void Function(Map<String, dynamic> meta) onMeta,
    required void Function(num creditCost) onDone,
  }) async {
    final req = http.Request('POST', _uri('/api/chat/stream'));
    req.headers.addAll(_headers);
    final body = <String, dynamic>{
      'messages': messages.map((m) => m.toJson()).toList(),
      'tier': tier,
      'manual': manual,
    };
    if (model != null) body['modelId'] = model.id;
    if (projectId != null) {
      body['projectId'] = projectId;
    }
    req.body = jsonEncode(body);

    final streamed = await http.Client().send(req);
    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      final body = await streamed.stream.bytesToString();
      final data = body.isEmpty
          ? <String, dynamic>{}
          : jsonDecode(body) as Map<String, dynamic>;
      throw Exception(data['error'] ?? 'Erreur API');
    }

    final lines = streamed.stream
        .transform(utf8.decoder)
        .transform(const LineSplitter());
    await for (final line in lines) {
      if (!line.startsWith('data: ')) {
        continue;
      }
      final data = jsonDecode(line.substring(6)) as Map<String, dynamic>;
      final type = data['type'];

      // ⚠ Routage exclusif : un chunk = UN seul canal (sinon raisonnement
      // s'ajoute aussi au contenu et apparaît en double dans la réponse)
      if (type == 'meta') {
        onMeta(data);
      } else if (type == 'error') {
        throw Exception(data['error']);
      } else if (type == 'thinking') {
        onThinking?.call('${data['delta'] ?? ''}');
      } else if (type == 'done') {
        onDone(data['creditCost'] is num ? data['creditCost'] as num : 0);
      } else if (type == 'websearch') {
        // ignoré pour l'instant côté mobile, à brancher plus tard
      } else if (data['delta'] != null) {
        onDelta('${data['delta']}');
      }
    }
  }
}
