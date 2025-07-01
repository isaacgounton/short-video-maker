import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import {
  SceneInput,
  RenderConfig,
  MusicMoodEnum,
  CaptionPositionEnum,
  TTSProvider,
  OrientationEnum,
  MusicVolumeEnum,
} from "../../types/shorts";

interface SceneFormData {
  text: string;
  searchTerms: string; // Changed to string
}

const VideoCreator: React.FC = () => {
  const navigate = useNavigate();
  const [scenes, setScenes] = useState<SceneFormData[]>([
    { text: "", searchTerms: "" },
  ]);
  const [config, setConfig] = useState<RenderConfig>({
    paddingBack: 1500,
    music: MusicMoodEnum.chill,
    captionPosition: CaptionPositionEnum.bottom,
    captionBackgroundColor: "blue",
    voice: "af_heart",
    provider: TTSProvider.Kokoro,
    orientation: OrientationEnum.portrait,
    musicVolume: MusicVolumeEnum.high,
    language: undefined, // Optional language override
  });

  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [providers, setProviders] = useState<TTSProvider[]>([]);
  const [musicTags, setMusicTags] = useState<MusicMoodEnum[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [providersResponse, musicResponse] = await Promise.all([
          axios.get("/api/tts/providers"),
          axios.get("/api/music-tags"),
        ]);

        // Handle both array and object responses
        const providersData = Array.isArray(providersResponse.data)
          ? providersResponse.data
          : providersResponse.data.providers || [];
        
        const musicData = Array.isArray(musicResponse.data)
          ? musicResponse.data
          : musicResponse.data.tags || [];
          
        setProviders(providersData);
        setMusicTags(musicData);

        // Fetch voices for the default provider
        const voicesResponse = await axios.get(
          `/api/tts/${config.provider}/voices`,
        );
        
        // Handle both array and object responses
        let voicesData = Array.isArray(voicesResponse.data)
          ? voicesResponse.data
          : voicesResponse.data.voices || [];
        
        // If voices are objects with 'name' property, extract just the names
        if (voicesData.length > 0 && typeof voicesData[0] === 'object' && voicesData[0].name) {
          voicesData = voicesData.map(voice => voice.name);
        }
          
        setVoices(voicesData);
      } catch (err) {
        console.error("Failed to fetch options:", err);
        setError(
          "Failed to load voice providers and music options. Please refresh the page.",
        );
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  // Fetch voices when provider changes
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const voicesResponse = await axios.get(
          `/api/tts/${config.provider}/voices`,
        );
        
        // Handle both array and object responses
        let voicesData = Array.isArray(voicesResponse.data)
          ? voicesResponse.data
          : voicesResponse.data.voices || [];
        
        // If voices are objects with 'name' property, extract just the names
        if (voicesData.length > 0 && typeof voicesData[0] === 'object' && voicesData[0].name) {
          voicesData = voicesData.map(voice => voice.name);
        }
          
        setVoices(voicesData);
        // Update selected voice to the first available one for the new provider
        if (voicesData.length > 0) {
          handleConfigChange("voice", voicesData[0]);
        }
      } catch (err) {
        console.error("Failed to fetch voices:", err);
        setError("Failed to load voices for the selected provider.");
      }
    };

    if (config.provider) {
      fetchVoices();
    }
  }, [config.provider]);

  const handleAddScene = () => {
    setScenes([...scenes, { text: "", searchTerms: "" }]);
  };

  const handleRemoveScene = (index: number) => {
    if (scenes.length > 1) {
      const newScenes = [...scenes];
      newScenes.splice(index, 1);
      setScenes(newScenes);
    }
  };

  const handleSceneChange = (
    index: number,
    field: keyof SceneFormData,
    value: string,
  ) => {
    const newScenes = [...scenes];
    newScenes[index] = { ...newScenes[index], [field]: value };
    setScenes(newScenes);
  };

  const handleConfigChange = (field: keyof RenderConfig, value: any) => {
    setConfig({ ...config, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Convert scenes to the expected API format
      const apiScenes: SceneInput[] = scenes.map((scene) => ({
        text: scene.text,
        searchTerms: scene.searchTerms
          .split(",")
          .map((term) => term.trim())
          .filter((term) => term.length > 0),
      }));

      const response = await axios.post("/api/short-video", {
        scenes: apiScenes,
        config,
      });

      navigate(`/video/${response.data.videoId}`);
    } catch (err) {
      setError("Failed to create video. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // AI-powered helper functions
  const handleGenerateScenes = async (sceneIndex: number) => {
    const currentText = scenes[sceneIndex].text.trim();
    if (!currentText) {
      setError("Please enter some text first to generate scenes");
      return;
    }

    setLoadingAI(true);
    setError(null);

    try {
      const response = await axios.post("/api/generate-scenes-from-topic", {
        topic: currentText,
        language: config.language || "en"
      });

      if (response.data.scenes && response.data.scenes.length > 0) {
        const newScenes = response.data.scenes.map((scene: any) => ({
          text: scene.text,
          searchTerms: scene.searchTerms.join(", ")
        }));

        // Replace current scenes with generated ones
        setScenes(newScenes);
      }
    } catch (err) {
      setError("Failed to generate scenes. Please try again.");
      console.error(err);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleGenerateSearchTerms = async (sceneIndex: number) => {
    const currentText = scenes[sceneIndex].text.trim();
    if (!currentText) {
      setError("Please enter scene text first to generate search terms");
      return;
    }

    setLoadingAI(true);
    setError(null);

    try {
      const response = await axios.post("/api/generate-search-terms", {
        sceneText: currentText
      });

      if (response.data.searchTerms && response.data.searchTerms.length > 0) {
        const newScenes = [...scenes];
        newScenes[sceneIndex].searchTerms = response.data.searchTerms.join(", ");
        setScenes(newScenes);
      }
    } catch (err) {
      setError("Failed to generate search terms. Please try again.");
      console.error(err);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleAutoConfigureSettings = async () => {
    // Check if we have valid scenes
    const validScenes = scenes.filter(scene => 
      scene.text.trim() && scene.searchTerms.trim()
    );

    if (validScenes.length === 0) {
      setError("Please add at least one scene with text and search terms first");
      return;
    }

    setLoadingAI(true);
    setError(null);

    try {
      // Convert scenes to API format
      const apiScenes = validScenes.map(scene => ({
        text: scene.text,
        searchTerms: scene.searchTerms
          .split(",")
          .map((term) => term.trim())
          .filter((term) => term.length > 0)
      }));

      const response = await axios.post("/api/auto-configure-settings", {
        scenes: apiScenes
      });

      if (response.data.config) {
        const aiConfig = response.data.config;
        setConfig(prevConfig => ({
          ...prevConfig,
          ...(aiConfig.music && { music: aiConfig.music }),
          ...(aiConfig.captionPosition && { captionPosition: aiConfig.captionPosition }),
          ...(aiConfig.orientation && { orientation: aiConfig.orientation }),
          ...(aiConfig.provider && { provider: aiConfig.provider }),
        }));
      }
    } catch (err) {
      setError("Failed to auto-configure settings. Please try again.");
      console.error(err);
    } finally {
      setLoadingAI(false);
    }
  };

  if (loadingOptions) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="80vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="md" mx="auto" py={4}>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Video
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Typography variant="h5" component="h2" gutterBottom>
          Scenes
        </Typography>

        {scenes.map((scene, index) => (
          <Paper key={index} sx={{ p: 3, mb: 3 }}>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="h6">Scene {index + 1}</Typography>
              {scenes.length > 1 && (
                <IconButton
                  onClick={() => handleRemoveScene(index)}
                  color="error"
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Text"
                  multiline
                  rows={4}
                  value={scene.text}
                  onChange={(e) =>
                    handleSceneChange(index, "text", e.target.value)
                  }
                  required
                />
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AutoAwesomeIcon />}
                    onClick={() => handleGenerateScenes(index)}
                    disabled={loadingAI}
                  >
                    {loadingAI ? 'Generating...' : 'Generate'}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SearchIcon />}
                    onClick={() => handleGenerateSearchTerms(index)}
                    disabled={loadingAI || !scene.text.trim()}
                  >
                    Search Terms
                  </Button>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Search Terms (comma-separated)"
                  value={scene.searchTerms}
                  onChange={(e) =>
                    handleSceneChange(index, "searchTerms", e.target.value)
                  }
                  helperText="Enter keywords for background video, separated by commas"
                  required
                />
              </Grid>
            </Grid>
          </Paper>
        ))}

        <Box display="flex" justifyContent="center" mb={4}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddScene}
          >
            Add Scene
          </Button>
        </Box>

        <Divider sx={{ mb: 4 }} />

        <Typography variant="h5" component="h2" gutterBottom>
          Video Configuration
        </Typography>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="End Screen Padding (ms)"
                value={config.paddingBack}
                onChange={(e) =>
                  handleConfigChange("paddingBack", parseInt(e.target.value))
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">ms</InputAdornment>
                  ),
                }}
                helperText="Duration to keep playing after narration ends"
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Music Mood</InputLabel>
                <Select
                  value={config.music}
                  onChange={(e) => handleConfigChange("music", e.target.value)}
                  label="Music Mood"
                  required
                >
                  {Object.values(MusicMoodEnum).map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Caption Position</InputLabel>
                <Select
                  value={config.captionPosition}
                  onChange={(e) =>
                    handleConfigChange("captionPosition", e.target.value)
                  }
                  label="Caption Position"
                  required
                >
                  {Object.values(CaptionPositionEnum).map((position) => (
                    <MenuItem key={position} value={position}>
                      {position}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Caption Background Color"
                value={config.captionBackgroundColor}
                onChange={(e) =>
                  handleConfigChange("captionBackgroundColor", e.target.value)
                }
                helperText="Any valid CSS color (name, hex, rgba)"
                required
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>TTS Provider</InputLabel>
                <Select
                  value={config.provider}
                  onChange={(e) => handleConfigChange("provider", e.target.value)}
                  label="TTS Provider"
                  required
                >
                  {providers.map((provider) => (
                    <MenuItem key={provider} value={provider}>
                      {provider}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Voice</InputLabel>
                <Select
                  value={config.voice}
                  onChange={(e) => handleConfigChange("voice", e.target.value)}
                  label="Voice"
                  required
                >
                  {voices.map((voice, index) => {
                    // Ensure we always have a string value
                    const voiceValue = typeof voice === 'string' ? voice :
                                     (voice?.name || `voice-${index}`);
                    
                    return (
                      <MenuItem key={voiceValue} value={voiceValue}>
                        {voiceValue}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Orientation</InputLabel>
                <Select
                  value={config.orientation}
                  onChange={(e) =>
                    handleConfigChange("orientation", e.target.value)
                  }
                  label="Orientation"
                  required
                >
                  {Object.values(OrientationEnum).map((orientation) => (
                    <MenuItem key={orientation} value={orientation}>
                      {orientation}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth sx={{ mb: 1 }}>
                <InputLabel>Music Volume</InputLabel>
                <Select
                  value={config.musicVolume}
                  onChange={(e) =>
                    handleConfigChange("musicVolume", e.target.value)
                  }
                  label="Music Volume"
                  required
                >
                  {Object.values(MusicVolumeEnum).map((voice) => (
                    <MenuItem key={voice} value={voice}>
                      {voice}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth sx={{ mb: 1 }}>
                <InputLabel>Language (Optional)</InputLabel>
                <Select
                  value={config.language || ""}
                  onChange={(e) =>
                    handleConfigChange("language", e.target.value || undefined)
                  }
                  label="Language (Optional)"
                  displayEmpty
                >
                  <MenuItem value="">
                    <em>Auto-detect from voice</em>
                  </MenuItem>
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                  <MenuItem value="de">German</MenuItem>
                  <MenuItem value="it">Italian</MenuItem>
                  <MenuItem value="pt">Portuguese</MenuItem>
                  <MenuItem value="ru">Russian</MenuItem>
                  <MenuItem value="ja">Japanese</MenuItem>
                  <MenuItem value="ko">Korean</MenuItem>
                  <MenuItem value="zh">Chinese</MenuItem>
                  <MenuItem value="ar">Arabic</MenuItem>
                  <MenuItem value="hi">Hindi</MenuItem>
                  <MenuItem value="nl">Dutch</MenuItem>
                  <MenuItem value="pl">Polish</MenuItem>
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Override automatic language detection for caption generation
                </Typography>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        <Box display="flex" justifyContent="center" sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<TuneIcon />}
            onClick={handleAutoConfigureSettings}
            disabled={loadingAI || scenes.length === 0}
          >
            {loadingAI ? 'Configuring...' : 'Configure Settings'}
          </Button>
        </Box>

        <Box display="flex" justifyContent="center">
          <Button
            type="submit"
            variant="contained"
            color="primary"
            size="large"
            disabled={loading}
            sx={{ minWidth: 200 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Create Video"
            )}
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default VideoCreator;
