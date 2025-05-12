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

//const PROMPTCHAN_API_KEY = process.env.PROMPTCHAN_API_KEY;
const PROMPTCHAN_API_KEY = '4gVNUWk9XLLFmAREhYHjXg'; 
// Endpoint para generar imagen
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;

  // Validar prompt
  const forbiddenWords = ['menor', 'niño', 'niña', 'infante', 'child', 'kid', 'underage', 'preteen', 'teen'];
  const lowerPrompt = prompt.toLowerCase();
  if (!prompt || forbiddenWords.some(word => lowerPrompt.includes(word))) {
    return res.status(400).json({ error: 'El contenido ingresado no es permitido. Evita referencias a menores o contenido ilegal.' });
  }
  console.log('API Key:', PROMPTCHAN_API_KEY);
  console.log('Request body:', { key: PROMPTCHAN_API_KEY, prompt });

  try {
    const response = await axios.post(
      'https://prod.aicloudnetservices.com/', // Cambia al endpoint real de Promptchan AI
      {
        api_key: PROMPTCHAN_API_KEY, // Cambia según el formato requerido por Promptchan
        prompt,
        negative_prompt: 'bad quality, blurry, low resolution, extra limbs, deformed',
        width: 512,
        height: 512,
        samples: 1,
        num_inference_steps: 20, // Ajusta según la API de Promptchan
        guidance_scale: 7.5
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Respuesta inicial de Promptchan AI:', response.data);

    let imageUrl;
    // Ajusta según la estructura real de la respuesta de Promptchan AI
    if (response.data.status === 'success' && response.data.data && response.data.data.image_url) {
      imageUrl = response.data.data.image_url; // Cambia según el formato real
    } else if (response.data.status === 'processing' && response.data.job_id) {
      // Manejo de procesamiento asíncrono (si aplica)
      const maxAttempts = 30;
      let attempts = 0;
      while (!imageUrl && attempts < maxAttempts) {
        const statusResponse = await axios.get(
          `https://api.promptchan.ai/v1/status/${response.data.job_id}`, // Cambia al endpoint real
          {
            headers: {
              'Authorization': `Bearer ${PROMPTCHAN_API_KEY}`
            }
          }
        );
        console.log('Estado de procesamiento:', statusResponse.data);
        if (statusResponse.data.status === 'completed' && statusResponse.data.data.image_url) {
          imageUrl = statusResponse.data.data.image_url;
        } else if (statusResponse.data.status === 'failed') {
          throw new Error('Generación de imagen fallida: ' + JSON.stringify(statusResponse.data));
        }
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
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

app.use(express.static('public'));

app.listen(process.env.PORT || 3000, () => {
  console.log('Servidor corriendo');
});