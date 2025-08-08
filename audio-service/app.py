"""
Audio Service (Flask)
---------------------
Reusable microservice template that:
1) Generates a short audiobook script using OpenAI
2) Synthesizes audio using ElevenLabs

Env vars:
  # OpenAI (required)
  - OPENAI_API_KEY
  - OPENAI_MODEL (default: gpt-4o-mini)

  # ElevenLabs (required)
  - ELEVENLABS_API_KEY
  - ELEVENLABS_VOICE_ID
  - ELEVENLABS_MODEL_ID (default: eleven_multilingual_v2)

  # Server
  - PORT (default: 5001)
"""

from __future__ import annotations

import os
import base64
from typing import Any, Optional

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests


MIN_DURATION_MIN = 0.5
MAX_DURATION_MIN = 2.0


def sanitize_duration_minutes(raw_value: Any) -> float:
    try:
        minutes = float(raw_value)
    except Exception:
        minutes = 1.0
    if minutes < MIN_DURATION_MIN:
        return MIN_DURATION_MIN
    if minutes > MAX_DURATION_MIN:
        return MAX_DURATION_MIN
    return minutes



def generate_story_with_openai(api_key: str, model: str, prompt: str, duration_minutes: float) -> str:
    """Generate audiobook script using OpenAI Chat Completions via REST."""
    words_per_minute = 150
    target_words = max(150, min(3000, int(duration_minutes * words_per_minute)))
    system = (
        "You are an expert audiobook script writer. Craft a cohesive, engaging, and vivid mini audiobook script. "
        "Write in clear paragraphs suitable for narration. Do not include stage directions or headings. "
        f"Aim for roughly {target_words} words so it fits about {duration_minutes} minutes at ~150 WPM. "
        "Return only the script text."
    )
    user = f"Topic/Prompt: {prompt}\n\nPlease produce only plain text paragraphs."
    url = os.getenv('OPENAI_BASE_URL', 'https://api.openai.com/v1/chat/completions')
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    payload = {
        'model': model,
        'messages': [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        'temperature': 0.9,
        'max_tokens': 2048,
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f'OpenAI error: {resp.status_code} {resp.text}')
    data = resp.json()
    choices = data.get('choices') or []
    if not choices:
        return ''
    content = (choices[0].get('message', {}).get('content') or '').strip()
    return content


def synthesize_with_elevenlabs(api_key: str, voice_id: str, text: str, model_id: str = 'eleven_multilingual_v2') -> bytes:
    url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream'
    headers = {
        'xi-api-key': api_key,
        'accept': 'audio/mpeg',
        'content-type': 'application/json'
    }
    payload = {
        'text': text,
        'model_id': model_id,
        'voice_settings': {
            'stability': 0.5,
            'similarity_boost': 0.75
        }
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=120)
    if resp.status_code != 200:
        # Attempt to surface error details
        raise RuntimeError(f'ElevenLabs error: {resp.status_code} {resp.text}')
    return resp.content


def create_app():
    """Application factory for the audio service."""
    app = Flask(__name__)
    CORS(app)

    @app.get('/health')
    def health():
        return jsonify({'status': 'ok'})

    @app.post('/generate')
    def generate():
        try:
            # Parse input
            data: dict[str, Any] = request.get_json(force=True, silent=False) or {}
            prompt: str = (data.get('prompt') or '').strip()
            duration_minutes: float = sanitize_duration_minutes(data.get('duration_minutes') or 1.0)
            if not prompt:
                return jsonify({'error': 'prompt is required'}), 400

            # Env config
            openai_api_key: Optional[str] = os.getenv('OPENAI_API_KEY')
            openai_model: str = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
            eleven_api: Optional[str] = os.getenv('ELEVENLABS_API_KEY')
            voice_id: Optional[str] = os.getenv('ELEVENLABS_VOICE_ID')
            model_id: str = os.getenv('ELEVENLABS_MODEL_ID', 'eleven_multilingual_v2')
            if not openai_api_key:
                return jsonify({'error': 'Server missing OPENAI_API_KEY'}), 500
            if not eleven_api:
                return jsonify({'error': 'Server missing ELEVENLABS_API_KEY'}), 500
            if not voice_id:
                return jsonify({'error': 'Server missing ELEVENLABS_VOICE_ID'}), 500

            # Generate transcript only via OpenAI
            try:
                transcript = generate_story_with_openai(openai_api_key, openai_model, prompt, duration_minutes)
            except Exception as e:
                return jsonify({'error': f'OpenAI generation failed: {str(e)}'}), 500
            if not transcript:
                return jsonify({'error': 'OpenAI returned empty content'}), 500

            # Synthesize
            audio_bytes = synthesize_with_elevenlabs(eleven_api, voice_id, transcript, model_id=model_id)
            audio_base64 = base64.b64encode(audio_bytes).decode('ascii')
            return jsonify({
                'audio_base64': audio_base64,
                'transcript': transcript,
                'mime': 'audio/mpeg',
                'generator': 'openai',
                'openai_model': openai_model,
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return app


app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5001')))

