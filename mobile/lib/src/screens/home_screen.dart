import 'dart:math';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../api/deltai_api.dart';
import '../models/models.dart';
import 'settings_screen.dart';
import '../theme/delt_theme.dart';
import '../widgets/delt_components.dart';
import '../widgets/delt_ui.dart';
import '../widgets/image_gen_sheet.dart';
import '../widgets/message_renderer.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.api,
    required this.user,
    required this.onLogout,
  });
  final DeltaIApi api;
  final DeltUser user;
  final VoidCallback onLogout;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static final _random = Random.secure();
  final _messages = <ChatMessage>[];
  final _projects = <DeltProject>[];
  final _conversations = <DeltConversation>[];
  final _models = <DeltModel>[];
  final _parallelModels = <DeltModel>[];

  DeltProject? _activeProject;
  DeltConversation? _activeConversation;
  DeltModel? _selectedModel;
  num _credits = 0;
  bool _loading = true;
  bool _busy = false;
  bool _autoMode = true;
  bool _routing = false;
  String? _error;

  bool get _effectiveAutoMode => widget.user.plan != 'FREE' && _autoMode;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        widget.api.projects(),
        widget.api.conversations(),
        widget.api.catalog(),
        widget.api.quota(),
      ]);
      final models = results[2] as List<DeltModel>;
      setState(() {
        _projects
          ..clear()
          ..addAll(results[0] as List<DeltProject>);
        _conversations
          ..clear()
          ..addAll(results[1] as List<DeltConversation>);
        _models
          ..clear()
          ..addAll(models);
        _selectedModel = models.firstWhere(
          (m) => m.id == 'mistralai/mistral-small-2603',
          orElse: () => models.isNotEmpty
              ? models.first
              : const DeltModel(
                  id: 'openai/gpt-oss-120b:free',
                  brand: 'OpenAI',
                  display: 'GPT OSS 120B',
                  tier: 'FREE',
                  cost: 0,
                ),
        );
        _credits = results[3] as num;
      });
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<DeltConversation> get _visibleConversations {
    final id = _activeProject?.id;
    if (id == null) {
      return _conversations.where((c) => c.projectId == null).toList();
    }
    return _conversations.where((c) => c.projectId == id).toList();
  }

  void _selectProject(DeltProject? project) {
    setState(() {
      _activeProject = project;
      _activeConversation = null;
      _messages.clear();
      _error = null;
    });
    Navigator.pop(context);
  }

  Future<void> _createProject() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nouveau projet'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Nom'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Créer'),
          ),
        ],
      ),
    );
    if (name == null || name.isEmpty) return;
    final project = await widget.api.createProject(name: name);
    setState(() {
      _projects.insert(0, project);
      _activeProject = project;
      _activeConversation = null;
      _messages.clear();
    });
  }

  Future<void> _openConversation(DeltConversation conv) async {
    final messages = await widget.api.conversation(conv.id);
    setState(() {
      _activeConversation = conv;
      _activeProject = conv.projectId == null
          ? null
          : _projects.where((p) => p.id == conv.projectId).firstOrNull;
      _messages
        ..clear()
        ..addAll(messages);
    });
    if (mounted) Navigator.pop(context);
  }

  void _newChat() {
    setState(() {
      _activeConversation = null;
      _messages.clear();
      _error = null;
    });
  }

  Future<void> _openImageGen() async {
    final result = await showImageGenSheet(
      context: context,
      api: widget.api,
      initialPrompt: null,
    );
    if (!mounted || result == null) return;
    final url = '${result['url']}';
    final prompt = '${result['prompt']}';
    final model = (result['model'] as Map?)?.cast<String, dynamic>();
    setState(() {
      _messages.add(ChatMessage(role: 'user', content: prompt));
      _messages.add(ChatMessage(
        role: 'assistant',
        content: prompt,
        imageUrl: url,
        model: model,
      ));
    });
    // Refresh quota après facturation
    try {
      final q = await widget.api.quota();
      if (mounted && q is num) setState(() => _credits = q);
    } catch (_) { /* ignore */ }
  }

  bool get _canMerge {
    final n = _parallelModels.length;
    if (n < 2 || _busy) return false;
    if (_messages.length < n + 1) return false;
    // Vérifie que les N derniers messages sont assistant + non streaming + non error + non merged
    for (var i = _messages.length - n; i < _messages.length; i++) {
      final m = _messages[i];
      if (m.role != 'assistant' || m.streaming || m.error || m.content.isEmpty) {
        return false;
      }
      if (m.model?['id'] == 'merge') return false;
    }
    // Le message juste avant doit être un user message
    return _messages[_messages.length - n - 1].role == 'user';
  }

  Future<void> _merge() async {
    final n = _parallelModels.length;
    if (n < 2 || _busy) return;
    final userMessage = _messages[_messages.length - n - 1];
    final responses = <Map<String, String>>[];
    for (var i = _messages.length - n; i < _messages.length; i++) {
      final m = _messages[i];
      responses.add({
        'model': '${m.model?['display'] ?? m.model?['id'] ?? 'modèle'}',
        'content': m.content,
      });
    }

    final mergeIndex = _messages.length;
    setState(() {
      _busy = true;
      _error = null;
      _messages.add(
        const ChatMessage(
          role: 'assistant',
          content: '',
          streaming: true,
          model: {'id': 'merge', 'brand': 'DeltaAI', 'display': 'Fusion'},
        ),
      );
    });

    try {
      await widget.api.mergeStream(
        question: userMessage.content,
        responses: responses,
        projectId: _activeProject?.id,
        onMeta: (_) {},
        onDelta: (delta) {
          setState(() {
            final cur = _messages[mergeIndex];
            _messages[mergeIndex] = cur.copyWith(
              content: cur.content + delta,
            );
          });
        },
        onDone: (done) {
          final cost = done['creditCost'] is num ? done['creditCost'] as num : 0;
          setState(() {
            _credits = (_credits - cost).clamp(0, double.infinity);
            _messages[mergeIndex] = _messages[mergeIndex].copyWith(
              streaming: false,
            );
          });
        },
      );
      if (_activeConversation != null) {
        await widget.api.saveConversation(
          _activeConversation!.id,
          _messages,
          _activeProject?.id,
        );
      }
    } on DeltApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _messages[mergeIndex] = _messages[mergeIndex].copyWith(
          content: 'Erreur fusion: ${e.message}',
          streaming: false,
          error: true,
        );
      });
      DeltUI.error(context, e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<DeltAttachment?> _pickImage({required ImageSource source}) async {
    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(
        source: source,
        maxWidth: 2048,
        imageQuality: 85,
      );
      if (file == null) return null;
      final bytes = await file.readAsBytes();
      final att = await widget.api.uploadFile(
        bytes: bytes,
        filename: file.name,
        mime: 'image/${file.name.split('.').last.toLowerCase()}',
      );
      if (mounted) DeltUI.success(context, 'Image attachée');
      return att;
    } on DeltApiException catch (e) {
      if (mounted) DeltUI.error(context, e.message);
      return null;
    } catch (e) {
      if (mounted) DeltUI.error(context, 'Erreur: $e');
      return null;
    }
  }

  Future<void> _send(String text, List<DeltAttachment> attachments) async {
    final manualModel = _selectedModel;
    if (!_effectiveAutoMode && manualModel == null) return;
    if (text.isEmpty && attachments.isEmpty) return;
    final conv =
        _activeConversation ??
        DeltConversation(
          id: _uuidV4(),
          title: text.isEmpty ? '📎 Pièce jointe' : text,
          projectId: _activeProject?.id,
        );
    if (_activeConversation == null) {
      setState(() {
        _activeConversation = conv;
        _conversations.insert(0, conv);
      });
    }

    final userMessage = ChatMessage(
      role: 'user',
      content: text,
      attachments: attachments,
    );
    final history = [..._messages, userMessage];
    if (_parallelModels.length >= 2) {
      final startIndex = _messages.length + 1;
      setState(() {
        _busy = true;
        _error = null;
        _messages.add(userMessage);
        for (final model in _parallelModels) {
          _messages.add(
            ChatMessage(
              role: 'assistant',
              content: '',
              model: {
                'id': model.id,
                'brand': model.brand,
                'display': model.display,
              },
              streaming: true,
            ),
          );
        }
      });
      await _sendParallel(conv, history, startIndex);
      return;
    }

    final assistantIndex = _messages.length + 1;
    setState(() {
      _busy = true;
      _error = null;
      _messages.add(userMessage);
      _messages.add(
        const ChatMessage(role: 'assistant', content: '', streaming: true),
      );
    });

    try {
      DeltModel? model = manualModel;
      String tier = manualModel?.tier ?? 'NANO';
      var manual = true;
      if (_effectiveAutoMode) {
        setState(() => _routing = true);
        final route = await widget.api.route(text);
        tier = '${route['tier'] ?? 'NANO'}';
        model = null;
        manual = false;
        setState(() => _routing = false);
      }
      await widget.api.chatStream(
        messages: history,
        model: model,
        tier: tier,
        manual: manual,
        projectId: _activeProject?.id,
        onMeta: (meta) {
          setState(() {
            _messages[assistantIndex] = _messages[assistantIndex].copyWith(
              model: meta['model'] is Map<String, dynamic>
                  ? meta['model'] as Map<String, dynamic>
              : null,
            );
          });
        },
        onThinking: (delta) {
          setState(() {
            final current = _messages[assistantIndex];
            _messages[assistantIndex] = current.copyWith(
              reasoning: '${current.reasoning ?? ''}$delta',
              thinking: true,
            );
          });
        },
        onDelta: (delta) {
          setState(() {
            final current = _messages[assistantIndex];
            final content = _stripReasoningEcho(
              current.content + delta,
              current.reasoning,
            );
            _messages[assistantIndex] = current.copyWith(
              content: content,
              thinking: false,
            );
          });
        },
        onDone: (done) {
          final cost = done['creditCost'] is num ? done['creditCost'] as num : 0;
          setState(() {
            _credits = (_credits - cost).clamp(0, double.infinity);
            _messages[assistantIndex] = _messages[assistantIndex].copyWith(
              streaming: false,
              thinking: false,
            );
          });
        },
      );
      await widget.api.saveConversation(conv.id, _messages, _activeProject?.id);
    } catch (e) {
      setState(() {
        _routing = false;
        _error = e.toString().replaceFirst('Exception: ', '');
        _messages[assistantIndex] = _messages[assistantIndex].copyWith(
          content: 'Erreur: $_error',
          streaming: false,
        );
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendParallel(
    DeltConversation conv,
    List<ChatMessage> history,
    int startIndex,
  ) async {
    try {
      await Future.wait([
        for (var i = 0; i < _parallelModels.length; i++)
          _streamParallelModel(
            index: startIndex + i,
            model: _parallelModels[i],
            history: history,
          ),
      ]);
      await widget.api.saveConversation(conv.id, _messages, _activeProject?.id);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _streamParallelModel({
    required int index,
    required DeltModel model,
    required List<ChatMessage> history,
  }) async {
    try {
      await widget.api.chatStream(
        messages: history,
        model: model,
        tier: model.tier,
        manual: true,
        projectId: _activeProject?.id,
        onMeta: (meta) {
          setState(() {
            _messages[index] = _messages[index].copyWith(
              model: meta['model'] is Map<String, dynamic>
                  ? meta['model'] as Map<String, dynamic>
                  : _messages[index].model,
            );
          });
        },
        onThinking: (delta) {
          setState(() {
            final current = _messages[index];
            _messages[index] = current.copyWith(
              reasoning: '${current.reasoning ?? ''}$delta',
              thinking: true,
            );
          });
        },
        onDelta: (delta) {
          setState(() {
            final current = _messages[index];
            _messages[index] = current.copyWith(
              content: _stripReasoningEcho(
                current.content + delta,
                current.reasoning,
              ),
              thinking: false,
            );
          });
        },
        onDone: (done) {
          final cost = done['creditCost'] is num ? done['creditCost'] as num : 0;
          setState(() {
            _credits = (_credits - cost).clamp(0, double.infinity);
            _messages[index] = _messages[index].copyWith(
              streaming: false,
              thinking: false,
            );
          });
        },
      );
    } catch (e) {
      setState(() {
        _messages[index] = _messages[index].copyWith(
          content: 'Erreur: ${e.toString().replaceFirst('Exception: ', '')}',
          streaming: false,
          thinking: false,
        );
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: _buildDrawer(),
      appBar: AppBar(
        elevation: 0,
        surfaceTintColor: Colors.white,
        backgroundColor: Colors.white,
        titleSpacing: 0,
        title: Row(
          children: [
            const DeltLogo(size: 36, showText: true),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _activeProject?.name ?? 'DeltaAI',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(
                    '${widget.user.plan} · ${_credits.toStringAsFixed(2)} Cr',
                    style: const TextStyle(
                      fontSize: 11,
                      color: DeltColors.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(onPressed: _newChat, icon: const Icon(Icons.edit_square)),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'logout') widget.onLogout();
              if (v == 'settings') {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => SettingsScreen(
                      api: widget.api,
                      user: widget.user,
                      models: _models,
                      onAccountDeleted: widget.onLogout,
                    ),
                  ),
                );
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'settings', child: Text('Paramètres')),
              PopupMenuItem(value: 'logout', child: Text('Déconnexion')),
            ],
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : Column(
              children: [
                if (_activeProject != null)
                  _ProjectBanner(project: _activeProject!),
                if (_models.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: ModelRail(
                      models: _models,
                      selected: _selectedModel,
                      onSelect: (m) => setState(() {
                        _selectedModel = m;
                        _autoMode = false;
                      }),
                    ),
                  ),
                if (_error != null)
                  Container(
                    margin: const EdgeInsets.all(12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF1F2),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _error!,
                            style: const TextStyle(color: Colors.red),
                          ),
                        ),
                        IconButton(
                          onPressed: () => setState(() => _error = null),
                          icon: const Icon(Icons.close),
                        ),
                      ],
                    ),
                  ),
                Expanded(
                  child: _messages.isEmpty
                      ? _Welcome(project: _activeProject)
                      : _MessageList(messages: _messages),
                ),
                ComposerBox(
                  busy: _busy,
                  onSend: _send,
                  onPickImage: _pickImage,
                  selectedModel: _selectedModel,
                  parallelCount: _parallelModels.length,
                  onOpenImageGen: _busy ? null : _openImageGen,
                  onOpenParallel: _models.isEmpty
                      ? null
                      : () async {
                          final picked = await showParallelPickerSheet(
                            context,
                            models: _models,
                            selected: _parallelModels,
                          );
                          if (picked != null) {
                            setState(() {
                              _parallelModels
                                ..clear()
                                ..addAll(picked);
                              if (_parallelModels.length >= 2) {
                                _autoMode = false;
                              }
                            });
                          }
                        },
                  onOpenModels: _models.isEmpty
                      ? null
                      : () => showModelSelectorSheet(
                          context,
                          models: _models,
                          selected: _selectedModel,
                          onSelect: (m) => setState(() {
                            _selectedModel = m;
                            _autoMode = false;
                          }),
                          showAuto: widget.user.plan != 'FREE',
                          autoMode: _effectiveAutoMode,
                          onAuto: () => setState(() => _autoMode = true),
                          initialBrand: _selectedModel?.brand,
                        ),
                  autoMode: _effectiveAutoMode,
                  routing: _routing,
                ),
              ],
            ),
    );
  }

  Future<void> _conversationActions(DeltConversation conv) async {
    final action = await DeltUI.actions<String>(
      context,
      title: conv.title,
      actions: const [
        DeltAction(
          label: 'Ouvrir',
          icon: Icons.open_in_new_rounded,
          value: 'open',
        ),
        DeltAction(
          label: 'Supprimer',
          icon: Icons.delete_outline,
          value: 'delete',
          subtitle: 'Suppression définitive',
          destructive: true,
        ),
      ],
    );
    if (!mounted || action == null) return;
    if (action == 'open') {
      await _openConversation(conv);
    } else if (action == 'delete') {
      final ok = await DeltUI.confirm(
        context,
        title: 'Supprimer la conversation ?',
        message: '"${conv.title}" sera supprimée définitivement.',
        confirmLabel: 'Supprimer',
        destructive: true,
      );
      if (!ok) return;
      try {
        await widget.api.deleteConversation(conv.id);
        if (!mounted) return;
        setState(() {
          _conversations.removeWhere((c) => c.id == conv.id);
          if (_activeConversation?.id == conv.id) {
            _activeConversation = null;
            _messages.clear();
          }
        });
        DeltUI.success(context, 'Conversation supprimée');
      } on DeltApiException catch (e) {
        if (mounted) DeltUI.error(context, e.message);
      }
    }
  }

  Future<void> _projectActions(DeltProject project) async {
    final action = await DeltUI.actions<String>(
      context,
      title: '${project.icon}  ${project.name}',
      actions: const [
        DeltAction(
          label: 'Renommer',
          icon: Icons.edit_outlined,
          value: 'rename',
        ),
        DeltAction(
          label: 'Supprimer',
          icon: Icons.delete_outline,
          value: 'delete',
          subtitle: 'Conversations conservées (détachées)',
          destructive: true,
        ),
      ],
    );
    if (!mounted || action == null) return;
    if (action == 'rename') {
      final newName = await DeltUI.prompt(
        context,
        title: 'Renommer le projet',
        initialValue: project.name,
        label: 'Nom',
      );
      if (newName == null || newName.isEmpty) return;
      try {
        final updated = await widget.api.updateProject(project.id, name: newName);
        if (!mounted) return;
        setState(() {
          final i = _projects.indexWhere((p) => p.id == project.id);
          if (i >= 0) _projects[i] = updated;
          if (_activeProject?.id == project.id) _activeProject = updated;
        });
        DeltUI.success(context, 'Projet renommé');
      } on DeltApiException catch (e) {
        if (mounted) DeltUI.error(context, e.message);
      }
    } else if (action == 'delete') {
      final ok = await DeltUI.confirm(
        context,
        title: 'Supprimer ce projet ?',
        message:
            'Le projet "${project.name}" sera supprimé. Les conversations seront détachées (non supprimées).',
        confirmLabel: 'Supprimer',
        destructive: true,
      );
      if (!ok) return;
      try {
        await widget.api.deleteProject(project.id);
        if (!mounted) return;
        setState(() {
          _projects.removeWhere((p) => p.id == project.id);
          if (_activeProject?.id == project.id) {
            _activeProject = null;
            _messages.clear();
          }
        });
        DeltUI.success(context, 'Projet supprimé');
      } on DeltApiException catch (e) {
        if (mounted) DeltUI.error(context, e.message);
      }
    }
  }

  Drawer _buildDrawer() {
    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 12, 10),
              child: Row(
                children: [
                  const Text(
                    'Projets',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: _createProject,
                    icon: const Icon(Icons.add_circle_outline),
                  ),
                ],
              ),
            ),
            ListTile(
              leading: const Text('💬', style: TextStyle(fontSize: 22)),
              title: const Text(
                'Tous les chats',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              selected: _activeProject == null,
              onTap: () => _selectProject(null),
            ),
            Expanded(
              child: ListView(
                children: [
                  ..._projects.map(
                    (p) => ListTile(
                      leading: Text(
                        p.icon,
                        style: const TextStyle(fontSize: 22),
                      ),
                      title: Text(
                        p.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: Text(
                        '${p.conversationCount} conv',
                        style: const TextStyle(fontSize: 11),
                      ),
                      selected: _activeProject?.id == p.id,
                      onTap: () => _selectProject(p),
                      onLongPress: () => _projectActions(p),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 18, 16, 6),
                    child: Text(
                      'Historique',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        color: DeltColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  ..._visibleConversations.map(
                    (c) => ListTile(
                      leading: const Icon(Icons.chat_bubble_outline, size: 20),
                      title: Text(
                        c.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: Text(
                        '${c.messageCount} messages',
                        style: const TextStyle(fontSize: 11),
                      ),
                      selected: _activeConversation?.id == c.id,
                      onTap: () => _openConversation(c),
                      onLongPress: () => _conversationActions(c),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _uuidV4() {
    final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int b) => b.toRadixString(16).padLeft(2, '0');
    final h = bytes.map(hex).join();
    return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
  }

  static String _stripReasoningEcho(String content, String? reasoning) {
    var clean = content
        .replaceAll(RegExp(r'<think>[\s\S]*?</think>', caseSensitive: false), '')
        .replaceAll(RegExp(r'<thinking>[\s\S]*?</thinking>', caseSensitive: false), '')
        .replaceAll(RegExp(r'<think>[\s\S]*$', caseSensitive: false), '')
        .replaceAll(RegExp(r'<thinking>[\s\S]*$', caseSensitive: false), '')
        .replaceAll(RegExp(r'</think>|</thinking>', caseSensitive: false), '');

    final thought = reasoning?.trim();
    if (thought == null || thought.length < 24) return clean;

    if (clean.trimLeft().startsWith(thought)) {
      final leading = clean.length - clean.trimLeft().length;
      clean = clean.substring(0, leading) + clean.trimLeft().substring(thought.length);
    }
    clean = _stripCommonReasoningPrefix(clean, thought);
    return clean.replaceFirst(RegExp(r'^\s*(Réponse|Answer)\s*:\s*'), '');
  }

  static String _stripCommonReasoningPrefix(String content, String reasoning) {
    final leading = content.length - content.trimLeft().length;
    final left = content.trimLeft();
    final cleanWords = RegExp(r'\S+').allMatches(left).toList();
    final thoughtWords = RegExp(r'\S+').allMatches(reasoning).toList();
    final maxWords = min(cleanWords.length, thoughtWords.length);
    var common = 0;
    for (; common < maxWords; common++) {
      final a = _wordKey(cleanWords[common].group(0)!);
      final b = _wordKey(thoughtWords[common].group(0)!);
      if (a.isEmpty || a != b) break;
    }
    if (common < 8) return content;
    final cut = cleanWords[common - 1].end;
    return content.substring(0, leading) + left.substring(cut).trimLeft();
  }

  static String _wordKey(String value) => value
      .toLowerCase()
      .replaceAll(RegExp(r'^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$', unicode: true), '');
}

class _ProjectBanner extends StatelessWidget {
  const _ProjectBanner({required this.project});
  final DeltProject project;

  @override
  Widget build(BuildContext context) {
    final color = hexColor(project.color);
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 6, 12, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .08),
        border: Border.all(color: color.withValues(alpha: .28)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Text(project.icon, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Chat projet',
                  style: TextStyle(
                    fontSize: 10,
                    color: DeltColors.muted,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  project.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: color, fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
          const Icon(Icons.auto_awesome, color: DeltColors.muted, size: 18),
        ],
      ),
    );
  }
}

class _Welcome extends StatelessWidget {
  const _Welcome({this.project});
  final DeltProject? project;

  @override
  Widget build(BuildContext context) {
    // Hauteur disponible — on adapte la taille du logo si l'espace est court
    return LayoutBuilder(
      builder: (context, constraints) {
        final h = constraints.maxHeight;
        // Logo adaptatif : grand si on a la place, sinon réduit pour éviter overflow
        double logoSize;
        if (h < 220) {
          logoSize = 64;
        } else if (h < 320) {
          logoSize = 88;
        } else {
          logoSize = project == null ? 132 : 112;
        }
        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DeltLogo(size: logoSize, showText: true),
                const SizedBox(height: 14),
                Text(
                  project == null
                      ? 'Comment puis-je t’aider ?'
                      : 'Nouveau chat dans ${project!.name}',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: h < 220 ? 18 : 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  project == null
                      ? 'Choisis un modèle et démarre une conversation.'
                      : 'Tous les modèles recevront le contexte de ce projet.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: DeltColors.muted, fontSize: 13),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _MessageList extends StatelessWidget {
  const _MessageList({required this.messages});
  final List<ChatMessage> messages;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      reverse: false,
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
      itemCount: messages.length,
      separatorBuilder: (context, index) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final message = messages[index];
        final isUser = message.role == 'user';
        if (isUser) {
          return Align(
            alignment: Alignment.centerRight,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.sizeOf(context).width * .86,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (message.attachments?.isNotEmpty == true) ...[
                    Wrap(
                      alignment: WrapAlignment.end,
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final att in message.attachments!)
                          if (att.kind == 'image' && att.url != null)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.network(
                                att.url!,
                                width: 140,
                                height: 140,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  width: 140,
                                  height: 140,
                                  color: DeltColors.surface,
                                  child: const Icon(
                                    Icons.broken_image_outlined,
                                    color: DeltColors.muted,
                                  ),
                                ),
                              ),
                            )
                          else
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: DeltColors.surface,
                                border: Border.all(color: DeltColors.border),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.attach_file_rounded,
                                    size: 15,
                                    color: DeltColors.muted,
                                  ),
                                  const SizedBox(width: 5),
                                  Text(
                                    att.name,
                                    style: const TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                      ],
                    ),
                    if (message.content.isNotEmpty) const SizedBox(height: 6),
                  ],
                  if (message.content.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: DeltColors.text,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        message.content,
                        style: const TextStyle(
                          color: Colors.white,
                          height: 1.35,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 28,
              height: 28,
              margin: const EdgeInsets.only(top: 1),
              decoration: BoxDecoration(
                color: DeltColors.panel,
                border: Border.all(color: DeltColors.border),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: message.model == null
                  ? const Icon(
                      Icons.auto_awesome_rounded,
                      size: 15,
                      color: DeltColors.accent,
                    )
                  : BrandIcon(brand: '${message.model!['brand']}', size: 16),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (message.reasoning?.trim().isNotEmpty == true)
                    ThinkingBlock(
                      reasoning: message.reasoning!,
                      streaming: message.thinking,
                    ),
                  if (message.model != null)
                    MessageModelHeader(model: message.model!),
                  if (message.streaming && message.content.isEmpty)
                    const Row(
                      children: [
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Génération...',
                          style: TextStyle(color: DeltColors.muted),
                        ),
                      ],
                    )
                  else if (message.imageUrl != null)
                    _ImageBubble(url: message.imageUrl!, caption: message.content)
                  else
                    MessageRenderer(
                      content: _HomeScreenState._stripReasoningEcho(
                        message.content,
                        message.reasoning,
                      ),
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ImageBubble extends StatelessWidget {
  const _ImageBubble({required this.url, this.caption});
  final String url;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: AspectRatio(
            aspectRatio: 1,
            child: Container(
              decoration: BoxDecoration(
                color: DeltColors.surface,
                border: Border.all(color: DeltColors.border),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Image.network(
                url,
                fit: BoxFit.cover,
                loadingBuilder: (ctx, child, progress) {
                  if (progress == null) return child;
                  return const Center(
                    child: SizedBox(
                      width: 24, height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  );
                },
                errorBuilder: (ctx, err, stack) => const Center(
                  child: Icon(Icons.broken_image_outlined,
                      size: 32, color: DeltColors.muted),
                ),
              ),
            ),
          ),
        ),
        if (caption != null && caption!.trim().isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            caption!,
            style: const TextStyle(
              fontSize: 12,
              color: DeltColors.muted,
              fontStyle: FontStyle.italic,
            ),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ],
    );
  }
}
