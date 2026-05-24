class DeltUser {
  const DeltUser({required this.id, required this.email, required this.plan});
  final String id;
  final String email;
  final String plan;

  factory DeltUser.fromJson(Map<String, dynamic> json) => DeltUser(
    id: '${json['id']}',
    email: '${json['email']}',
    plan: '${json['plan'] ?? 'FREE'}',
  );
}

class DeltProject {
  const DeltProject({
    required this.id,
    required this.name,
    this.description,
    this.color = '#6366f1',
    this.icon = '📁',
    this.conversationCount = 0,
  });

  final String id;
  final String name;
  final String? description;
  final String color;
  final String icon;
  final int conversationCount;

  factory DeltProject.fromJson(Map<String, dynamic> json) => DeltProject(
    id: '${json['id']}',
    name: '${json['name'] ?? 'Projet'}',
    description: json['description']?.toString(),
    color: '${json['color'] ?? '#6366f1'}',
    icon: '${json['icon'] ?? '📁'}',
    conversationCount: json['conversationCount'] is num
        ? (json['conversationCount'] as num).toInt()
        : 0,
  );
}

class DeltConversation {
  const DeltConversation({
    required this.id,
    required this.title,
    this.projectId,
    this.messageCount = 0,
  });

  final String id;
  final String title;
  final String? projectId;
  final int messageCount;

  factory DeltConversation.fromJson(Map<String, dynamic> json) =>
      DeltConversation(
        id: '${json['id']}',
        title: '${json['title'] ?? 'Nouvelle conversation'}',
        projectId: json['projectId']?.toString(),
        messageCount: json['messageCount'] is num
            ? (json['messageCount'] as num).toInt()
            : 0,
      );
}

class ChatMessage {
  const ChatMessage({
    required this.role,
    required this.content,
    this.model,
    this.reasoning,
    this.thinking = false,
    this.streaming = false,
    this.imageUrl,
  });

  final String role;
  final String content;
  final Map<String, dynamic>? model;
  final String? reasoning;
  final bool thinking;
  final bool streaming;
  final String? imageUrl;

  ChatMessage copyWith({
    String? content,
    Map<String, dynamic>? model,
    String? reasoning,
    bool? thinking,
    bool? streaming,
    String? imageUrl,
  }) => ChatMessage(
    role: role,
    content: content ?? this.content,
    model: model ?? this.model,
    reasoning: reasoning ?? this.reasoning,
    thinking: thinking ?? this.thinking,
    streaming: streaming ?? this.streaming,
    imageUrl: imageUrl ?? this.imageUrl,
  );

  Map<String, dynamic> toJson() => {
    'role': role,
    'content': content,
    if (model != null) 'model': model,
    if (reasoning != null && reasoning!.isNotEmpty) 'reasoning': reasoning,
    if (imageUrl != null) 'imageUrl': imageUrl,
  };

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
    role: '${json['role']}',
    content: '${json['content'] ?? ''}',
    model: json['model'] is Map<String, dynamic>
        ? json['model'] as Map<String, dynamic>
        : null,
    reasoning: json['reasoning']?.toString(),
    thinking: json['thinking'] == true,
    imageUrl: json['imageUrl']?.toString(),
  );
}

class DeltImageModel {
  const DeltImageModel({
    required this.id,
    required this.brand,
    required this.display,
    required this.cost,
    this.tagline,
    this.provider,
  });

  final String id;
  final String brand;
  final String display;
  final num cost;
  final String? tagline;
  final String? provider;

  factory DeltImageModel.fromJson(Map<String, dynamic> json) => DeltImageModel(
    id: '${json['id']}',
    brand: '${json['brand'] ?? 'AI'}',
    display: '${json['display'] ?? json['id']}',
    cost: json['cost'] is num ? json['cost'] as num : 0,
    tagline: json['tagline']?.toString(),
    provider: json['provider']?.toString(),
  );
}

class DeltModel {
  const DeltModel({
    required this.id,
    required this.brand,
    required this.display,
    required this.tier,
    required this.cost,
  });

  final String id;
  final String brand;
  final String display;
  final String tier;
  final num cost;

  factory DeltModel.fromJson(
    String tier,
    num cost,
    Map<String, dynamic> json,
  ) => DeltModel(
    id: '${json['id']}',
    brand: '${json['brand'] ?? 'AI'}',
    display: '${json['display'] ?? json['id']}',
    tier: tier,
    cost: cost,
  );
}
