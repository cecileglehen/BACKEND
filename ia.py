from openai import OpenAI

client = OpenAI(
    api_key="sk-delt-d94859e5f6b2826cebf0c2b304cbd83c7b69d048b03847e6",
    base_url="https://deltai-backend.onrender.com/v1"
)

response = client.chat.completions.create(
    model="openai/gpt-5.4-nano",
    messages=[{"role": "user", "content": "Explique la photosynthèse en 2 phrases."}]
)

print(response.choices[0].message.content)
print("Coût :", response.delt.credit_cost, "Cr")