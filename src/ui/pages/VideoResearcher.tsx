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
  Divider,
  Card,
  CardContent,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EditIcon from "@mui/icons-material/Edit";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  SceneInput,
  RenderConfig,
  MusicMoodEnum,
  CaptionPositionEnum,
  OrientationEnum,
  MusicVolumeEnum,
  TTSProvider,
} from "../../types/shorts";

interface ResearchResult {
  title: string;
  content: string;
  sources: string[];
  language: string;
}

interface GeneratedScenesResult {
  scenes: SceneInput[];
  config: RenderConfig;
}

const VideoResearcher: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [researching, setResearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [editableScenes, setEditableScenes] = useState<SceneInput[]>([]);
  const [editableConfig, setEditableConfig] = useState<RenderConfig>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Available options
  const [voices, setVoices] = useState<string[]>([]);
  const [musicTags, setMusicTags] = useState<string[]>([]);
  const [ttsProviders, setTtsProviders] = useState<TTSProvider[]>([]);
  const [voicesForProvider, setVoicesForProvider] = useState<Record<string, string[]>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingVoices, setLoadingVoices] = useState(false);

  const languages = [
    { code: "en", name: "English" },
    { code: "fr", name: "French" },
    { code: "es", name: "Spanish" },
    { code: "de", name: "German" },
    { code: "it", name: "Italian" },
    { code: "pt", name: "Portuguese" },
    { code: "ja", name: "Japanese" },
    { code: "zh", name: "Chinese" },
    { code: "ar", name: "Arabic" },
  ];

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [voicesResponse, musicResponse, providersResponse] = await Promise.all([
          axios.get("/api/voices"),
          axios.get("/api/music-tags"),
          axios.get("/api/tts/providers"),
        ]);

        setVoices(voicesResponse.data);
        setMusicTags(musicResponse.data);
        setTtsProviders(providersResponse.data);
        
        // Load voices for all providers
        const voicePromises = providersResponse.data.map(async (provider: TTSProvider) => {
          try {
            const response = await axios.get(`/api/tts/${provider}/voices`);
            return { provider, voices: response.data };
          } catch (err) {
            console.error(`Failed to fetch voices for ${provider}:`, err);
            return { provider, voices: [] };
          }
        });

        const voiceResults = await Promise.all(voicePromises);
        const voiceMap: Record<string, string[]> = {};
        voiceResults.forEach(({ provider, voices }) => {
          voiceMap[provider] = voices;
        });
        setVoicesForProvider(voiceMap);
      } catch (err) {
        console.error("Failed to fetch options:", err);
        setError("Failed to load configuration options. Please refresh the page.");
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  const handleResearch = async () => {
    if (!searchTerm.trim()) return;
    
    setResearching(true);
    setError(null);
    
    try {
      const response = await axios.post("/api/research-topic", {
        searchTerm: searchTerm.trim(),
        targetLanguage,
      });
      
      setResearchResult(response.data);
    } catch (err) {
      console.error("Research failed:", err);
      setError("Failed to research the topic. Please try again.");
    } finally {
      setResearching(false);
    }
  };

  const handleGenerateScenes = async () => {
    if (!researchResult) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const response = await axios.post("/api/generate-scenes", {
        content: researchResult.content,
        title: researchResult.title,
        targetLanguage,
      });
      
      setEditableScenes(response.data.scenes);
      setEditableConfig(response.data.config);
    } catch (err) {
      console.error("Scene generation failed:", err);
      setError("Failed to generate scenes. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSceneChange = (index: number, field: keyof SceneInput, value: any) => {
    const newScenes = [...editableScenes];
    newScenes[index] = { ...newScenes[index], [field]: value };
    setEditableScenes(newScenes);
  };

  const handleConfigChange = (field: keyof RenderConfig, value: any) => {
    const newConfig = { ...editableConfig, [field]: value };
    
    // If TTS provider changes, reset voice to first available voice for that provider
    if (field === 'provider' && voicesForProvider[value]) {
      const availableVoices = voicesForProvider[value];
      if (availableVoices.length > 0) {
        newConfig.voice = availableVoices[0];
      }
    }
    
    setEditableConfig(newConfig);
  };

  const handleCreateVideo = async () => {
    if (!editableScenes.length || !editableConfig) return;
    
    setCreating(true);
    setError(null);
    
    try {
      const response = await axios.post("/api/short-video", {
        scenes: editableScenes,
        config: editableConfig,
      });
      
      navigate(`/video/${response.data.videoId}`);
    } catch (err) {
      console.error("Video creation failed:", err);
      setError("Failed to create video. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // Get available voices for current TTS provider
  const getAvailableVoices = (): string[] => {
    if (!editableConfig.provider) return [];
    return voicesForProvider[editableConfig.provider] || [];
  };

  if (loadingOptions) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box maxWidth="lg" mx="auto" py={4}>
      <Typography variant="h4" component="h1" gutterBottom>
        AI Video Research & Creator
      </Typography>
      
      <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
        Enter a topic and let AI research it, then automatically generate and customize your video scenes.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Step 1: Research Topic */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Step 1: Research Topic
          </Typography>
          
          <Grid container spacing={3} alignItems="end">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Enter a topic or subject to research"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g., Climate change effects, AI in healthcare, History of space exploration"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleResearch();
                  }
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Target Language</InputLabel>
                <Select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  label="Target Language"
                >
                  {languages.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleResearch}
                disabled={!searchTerm.trim() || researching}
                startIcon={researching ? <CircularProgress size={20} /> : <SearchIcon />}
              >
                {researching ? "Researching..." : "Research"}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Step 2: Research Results */}
      {researchResult && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Step 2: Research Results
            </Typography>
            
            <Typography variant="h6" color="primary" gutterBottom>
              {researchResult.title}
            </Typography>
            
            <Typography variant="body2" paragraph>
              {researchResult.content.substring(0, 300)}...
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Sources:
              </Typography>
              {researchResult.sources.map((source, index) => (
                <Chip key={index} label={source} size="small" sx={{ mr: 1, mb: 1 }} />
              ))}
            </Box>
            
            <Button
              variant="contained"
              color="secondary"
              onClick={handleGenerateScenes}
              disabled={generating}
              startIcon={generating ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
            >
              {generating ? "Generating Scenes..." : "Generate Video Scenes"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Generated Scenes & Configuration */}
      {editableScenes.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Step 3: Review & Customize Scenes
            </Typography>
            
            {/* Generated Scenes */}
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Generated Scenes ({editableScenes.length})
            </Typography>
            
            {editableScenes.map((scene, index) => (
              <Accordion key={index} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">
                    Scene {index + 1}: {scene.text.substring(0, 50)}...
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Text"
                        multiline
                        rows={3}
                        value={scene.text}
                        onChange={(e) => handleSceneChange(index, "text", e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Search Terms (comma-separated)"
                        value={scene.searchTerms.join(", ")}
                        onChange={(e) => 
                          handleSceneChange(index, "searchTerms", 
                            e.target.value.split(",").map(term => term.trim()).filter(term => term.length > 0)
                          )
                        }
                        helperText="Keywords for background video"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}

            {/* Video Configuration */}
            <Divider sx={{ my: 3 }} />
            
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1">
                Video Configuration
              </Typography>
              <Button
                size="small"
                onClick={() => setShowAdvanced(!showAdvanced)}
                startIcon={<EditIcon />}
              >
                {showAdvanced ? "Hide" : "Show"} Advanced Settings
              </Button>
            </Box>

            {showAdvanced && (
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>TTS Provider</InputLabel>
                    <Select
                      value={editableConfig.provider || TTSProvider.Kokoro}
                      onChange={(e) => handleConfigChange("provider", e.target.value)}
                      label="TTS Provider"
                    >
                      {ttsProviders.map((provider) => (
                        <MenuItem key={provider} value={provider}>
                          {provider === TTSProvider.Kokoro && "Kokoro (AI Voice)"}
                          {provider === TTSProvider.OpenAIEdge && "OpenAI Edge TTS (High Quality)"}
                          {provider === TTSProvider.Chatterbox && "Chatterbox TTS"}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Voice</InputLabel>
                    <Select
                      value={editableConfig.voice || ""}
                      onChange={(e) => handleConfigChange("voice", e.target.value)}
                      label="Voice"
                      disabled={loadingVoices}
                    >
                      {getAvailableVoices().map((voice) => (
                        <MenuItem key={voice} value={voice}>
                          {voice}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Music Mood</InputLabel>
                    <Select
                      value={editableConfig.music || MusicMoodEnum.chill}
                      onChange={(e) => handleConfigChange("music", e.target.value)}
                      label="Music Mood"
                    >
                      {Object.values(MusicMoodEnum).map((mood) => (
                        <MenuItem key={mood} value={mood}>
                          {mood}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Orientation</InputLabel>
                    <Select
                      value={editableConfig.orientation || OrientationEnum.portrait}
                      onChange={(e) => handleConfigChange("orientation", e.target.value)}
                      label="Orientation"
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
                  <FormControl fullWidth>
                    <InputLabel>Caption Position</InputLabel>
                    <Select
                      value={editableConfig.captionPosition || CaptionPositionEnum.bottom}
                      onChange={(e) => handleConfigChange("captionPosition", e.target.value)}
                      label="Caption Position"
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
                  <FormControl fullWidth>
                    <InputLabel>Music Volume</InputLabel>
                    <Select
                      value={editableConfig.musicVolume || MusicVolumeEnum.medium}
                      onChange={(e) => handleConfigChange("musicVolume", e.target.value)}
                      label="Music Volume"
                    >
                      {Object.values(MusicVolumeEnum).map((volume) => (
                        <MenuItem key={volume} value={volume}>
                          {volume}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            )}

            <Box display="flex" justifyContent="center" mt={4}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={handleCreateVideo}
                disabled={creating}
                startIcon={creating ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                sx={{ minWidth: 200 }}
              >
                {creating ? "Creating Video..." : "Create Video"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default VideoResearcher;
