#!/usr/bin/env python3
"""
Simple Example - OpenAI native client with AI GRID Proxy
"""

from openai import OpenAI
import time

# Configure OpenAI client to use your AI GRID proxy
client = OpenAI(
    base_url="http://app.ai-grid.io:4000/v1",        # Your AI GRID proxy endpoint
    api_key="sk-mhOCLLmm0o8AcVr-kkVp9g"
)

# Text in/ Text out openai/gpt-oss-20b
# Text in / semtantic out: 

# Streaming response
stream = client.chat.completions.create(
    model="openai/gpt-oss-20b",
    messages=[
        {"role": "system", "content": "You are a helpful assistant for testing AI GRID proxy."},
        {"role": "user", "content": "Why is AI Grid amazing? :D"},
    ],
    temperature=0.1,
    stream=True
)

print("Assistant:", end=" ", flush=True)
timing=[]
t= time.time()
for chunk in stream:
    timing.append(time.time()-t)
    t = time.time()
    # Each chunk contains a delta (partial token)
    delta = chunk.choices[0].delta
    if delta.content:   # Sometimes it's None for role info, etc.
        print(delta.content, end="", flush=True)

print()  # final newline
print("Time first Byte:", timing[0], " Time per output token:", timing[1])
print("TPS:", len(timing)/sum(timing))
