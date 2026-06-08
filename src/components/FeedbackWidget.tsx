import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, Bug, Lightbulb, Star, Zap, Upload, X, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "./ui/button";

type FeedbackType = "issue" | "suggestion" | "review" | "upgrade";

export function FeedbackWidget() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFunky = theme === "funky";

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !file && type !== "review") {
      toast.error("Please provide some feedback or a screenshot.");
      return;
    }
    if (type === "review" && rating === 0) {
      toast.error("Please provide a rating.");
      return;
    }

    setIsSubmitting(true);
    let screenshot_url = null;

    try {
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${user?.id || 'anonymous'}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("feedback_images")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("feedback_images").getPublicUrl(filePath);
        screenshot_url = data.publicUrl;
      }

      const { error } = await supabase.from("user_feedback").insert({
        user_id: user?.id || null,
        page_url: window.location.href,
        feedback_type: type,
        content: content.trim() || null,
        screenshot_url,
        rating: type === "review" ? rating : null,
      });

      if (error) throw error;

      setIsSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsSuccess(false);
        setContent("");
        setFile(null);
        setRating(0);
        setType("suggestion");
      }, 3000);
      
    } catch (err: any) {
      toast.error("Failed to submit: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl flex items-center justify-center transition-all ${
          isOpen ? "opacity-0 pointer-events-none scale-50" : "opacity-100 scale-100"
        } ${
          isFunky
            ? "bg-[#00ffaa] text-black border-2 border-black hover:-translate-y-2"
            : "gradient-neon text-primary-foreground hover:shadow-[0_0_30px_rgba(var(--neon),0.6)]"
        }`}
        style={isFunky ? { boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)" } : {}}
      >
        <MessageSquarePlus className="w-7 h-7" />
      </motion.button>

      {/* Modal Overlay & Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsOpen(false)}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]"
            />
            
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`fixed bottom-0 sm:bottom-6 left-0 right-0 sm:left-auto sm:right-6 w-full sm:w-[450px] z-[101] max-h-[90vh] overflow-y-auto ${
                isFunky 
                  ? "bg-white border-[3px] border-black text-black rounded-t-3xl sm:rounded-3xl p-6" 
                  : "bg-glass border border-border text-foreground rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
              }`}
              style={isFunky ? { boxShadow: "12px 12px 0px 0px rgba(0,0,0,1)" } : {}}
            >
              {isSuccess ? (
                <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                  >
                    <CheckCircle2 className={`w-24 h-24 mb-6 ${isFunky ? "text-[#00ffaa]" : "text-neon"}`} />
                  </motion.div>
                  <h2 className="text-2xl font-black mb-2">You're awesome!</h2>
                  <p className="text-muted-foreground">Thank you for making Bideros better.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold font-display flex items-center gap-2">
                      <MessageSquarePlus className={isFunky ? "text-[#ff0055]" : "text-neon"} /> 
                      Feedback
                    </h2>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className={`p-2 rounded-full transition-colors ${isFunky ? "hover:bg-black/10" : "hover:bg-white/10"}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Feedback Type Selection */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "suggestion", label: "Idea", icon: Lightbulb, color: "bg-[#00ffaa]" },
                        { id: "issue", label: "Issue", icon: Bug, color: "bg-[#ff0055]" },
                        { id: "review", label: "Review", icon: Star, color: "bg-[#ffb000]" },
                        { id: "upgrade", label: "Upgrade", icon: Zap, color: "bg-[#00d0ff]" }
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setType(t.id as FeedbackType)}
                          className={`flex items-center justify-center gap-2 py-3 px-2 rounded-xl border-2 transition-all font-bold text-sm ${
                            type === t.id 
                              ? isFunky 
                                ? `${t.color} border-black translate-y-[-2px]` 
                                : "bg-primary/20 border-primary text-neon shadow-[0_0_15px_rgba(var(--neon),0.2)]"
                              : isFunky 
                                ? "bg-gray-100 border-transparent hover:border-black text-gray-500 hover:text-black" 
                                : "bg-glass border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                          }`}
                          style={type === t.id && isFunky ? { boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)" } : {}}
                        >
                          <t.icon className={`w-4 h-4 ${type === t.id && !isFunky ? "text-neon" : ""}`} />
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Rating (Only for Review) */}
                    <AnimatePresence>
                      {type === "review" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex flex-col items-center py-2"
                        >
                          <p className="text-sm font-semibold mb-3">How would you rate your experience?</p>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                onClick={() => setRating(star)}
                                className="focus:outline-none transition-transform hover:scale-125"
                              >
                                <Star 
                                  className={`w-8 h-8 ${
                                    star <= (hoverRating || rating) 
                                      ? "fill-[#ffb000] text-[#ffb000] drop-shadow-[0_0_8px_rgba(255,176,0,0.5)]" 
                                      : "text-gray-300 dark:text-gray-600"
                                  }`} 
                                />
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Content Textarea */}
                    <div>
                      <label className="block text-sm font-bold mb-2">
                        {type === "issue" ? "What went wrong?" : 
                         type === "review" ? "Tell us more (Optional)" : 
                         "Share your brilliant idea"}
                      </label>
                      <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="I was trying to..."
                        className={`w-full p-4 rounded-xl resize-none outline-none transition-all h-32 ${
                          isFunky 
                            ? "bg-gray-50 border-2 border-black focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black" 
                            : "bg-background border border-border focus:border-neon focus:ring-1 focus:ring-neon text-foreground"
                        }`}
                      />
                    </div>

                    {/* Image Upload Dropzone */}
                    <div>
                      <label className="block text-sm font-bold mb-2 flex justify-between">
                        <span>Attach a Screenshot</span>
                        <span className="text-muted-foreground font-normal text-xs">Optional</span>
                      </label>
                      <div
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                          isDragging 
                            ? isFunky ? "border-[#00ffaa] bg-[#00ffaa]/10" : "border-neon bg-neon/10" 
                            : file 
                              ? isFunky ? "border-black bg-gray-50" : "border-border bg-background"
                              : isFunky ? "border-gray-300 hover:border-black bg-gray-50" : "border-border hover:border-primary/50 bg-background/50"
                        }`}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFile}
                          accept="image/*"
                          className="hidden"
                        />
                        {file ? (
                          <div className="flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <span className="font-semibold text-sm truncate max-w-[200px]">{file.name}</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setFile(null); }}
                              className="text-xs text-red-500 hover:underline ml-2"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <Upload className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm font-medium">Click or drag image here</p>
                            <p className="text-xs opacity-70 mt-1">PNG, JPG up to 5MB</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`w-full h-14 text-lg font-black mt-4 transition-all ${
                        isFunky 
                          ? "bg-black text-white hover:bg-[#00ffaa] hover:text-black border-2 border-black rounded-xl hover:-translate-y-1" 
                          : "gradient-neon text-primary-foreground rounded-xl shadow-[0_0_20px_rgba(var(--neon),0.3)] hover:scale-[1.02]"
                      }`}
                      style={isFunky ? { boxShadow: "6px 6px 0px 0px rgba(0,0,0,1)" } : {}}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Sending...</span>
                      ) : (
                        "Send Feedback"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
