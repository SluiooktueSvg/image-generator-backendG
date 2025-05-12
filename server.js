require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Habilitar CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

const MODELSlAB_API_KEY = process.env.MODELSLAB_API_KEY;

// Endpoint para generar imagen
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;

  // Validar prompt
  const forbiddenWords = ['menor', 'niño', 'niña', 'infante', 'child', 'kid', 'underage', 'preteen', 'teen'];
  const lowerPrompt = prompt.toLowerCase();
  if (!prompt || forbiddenWords.some(word => lowerPrompt.includes(word))) {
    return res.status(400).json({ error: 'El contenido ingresado no es permitido. Evita referencias a menores o contenido ilegal.' });
  }

  try {
    const response = await axios.post(
      'https://modelslab.com/api/v6/realtime/text2img',
      {
        key: MODELSlAB_API_KEY,
        prompt,
        negative_prompt: 'bad quality, blurry, low resolution, extra limbs, deformed',
        width: 512,
        height: 512,
        samples: 1,
        safety_checker: false,
        enhance_prompt: true,
        num_inference_steps: 30,
        guidance_scale: 7.5,
        scheduler: 'UniPCMultistepScheduler'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Respuesta inicial de ModelsLab:', response.data);

    let imageUrl;
    if (response.data.status === 'success' && response.data.output && Array.isArray(response.data.output)) {
      imageUrl = response.data.output[0];
    } else if (response.data.status === 'processing' && response.data.fetch_result) {
      const maxAttempts = 30;
      let attempts = 0;
      while (!imageUrl && attempts < maxAttempts) {
        const statusResponse = await axios.post(
          response.data.fetch_result,
          { key: MODELSlAB_API_KEY },
          { headers: { 'Content-Type': 'application/json' } }
        );
        console.log('Estado de procesamiento:', statusResponse.data);
        if (statusResponse.data.status === 'success' && statusResponse.data.output && Array.isArray(statusResponse.data.output)) {
          imageUrl = statusResponse.data.output[0];
        } else if (statusResponse.data.status === 'failed') {
          throw new Error('Generación de imagen fallida: ' + JSON.stringify(statusResponse.data));
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!imageUrl) {
        throw new Error('Tiempo de espera agotado para la generación de la imagen.');
      }
    } else {
      throw new Error(`Respuesta inválida de la API: ${JSON.stringify(response.data)}`);
    }

    if (!imageUrl) throw new Error('No se generó ninguna imagen.');

    res.json({ imageUrl });
  } catch (error) {
    console.error('Error completo:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Error al generar la imagen: ' + (error.response ? JSON.stringify(error.response.data) : error.message) });
  }
});

// Endpoint para generar descripción (sin usar)
app.post('/api/generate-description', async (req, res) => {
  res.status(501).json({ error: 'Generación de descripciones no implementada' });
});

// Servir archivos estáticos (opcional, para pruebas)
app.use(express.static('public'));

app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor corriendo');
});