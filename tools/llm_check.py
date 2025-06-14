import os, sys
from pathlib import Path
from ctransformers import AutoModelForCausalLM

model_path = Path(os.environ["MODEL_PATH"])
llm = AutoModelForCausalLM.from_pretrained(model_path,
                                           model_type="qwen",
                                           gpu_layers=0)   # CPU only

SYS = "You are a senior JS engine reviewer."

def review(js_snippet: str) -> str:
    prompt = (f"<|im_start|>system\n{SYS}<|im_end|>\n"
              f"<|im_start|>user\n{js_snippet}\n<|im_end|>\n"
              "<|im_start|>assistant\n")
    return llm(prompt, max_new_tokens=128)

for file in Path(".").rglob("*.fink.js"):
    print(f"\n--- {file} ---")
    print(review(file.read_text()[:4000]))
