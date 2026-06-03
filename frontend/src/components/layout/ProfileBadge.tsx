"use client";

import { useEffect, useState } from "react";
import { getProfile, type Profile } from "@/lib/api";

export default function ProfileBadge() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const data = await getProfile();
      // Check if data exists and isn't just an empty object {}
      if (data && Object.keys(data).length > 0) {
        setProfile(data);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error(error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();

    // Listen for the custom event from the New Learner button
    const handleProfileUpdate = () => fetchProfile();
    window.addEventListener("profileUpdated", handleProfileUpdate);
    
    return () => {
      window.removeEventListener("profileUpdated", handleProfileUpdate);
    };
  }, []);

  if (loading) {
    return <span className="text-sm text-zinc-500">Loading...</span>;
  }

  if (!profile) {
    return <span className="text-sm font-medium text-zinc-500">No profile set</span>;
  }

  // Quick fix: safely parse '["PT", "EN"]' into 'PT, EN'
  let formattedNativeLangs = profile.native_languages;
  try {
    if (profile.native_languages) {
      const parsed = JSON.parse(profile.native_languages);
      if (Array.isArray(parsed)) {
        formattedNativeLangs = parsed.join(", ");
      }
    }
  } catch (e) {
    // If it fails to parse, it's probably already a normal string. We do nothing.
  }

  return (
    <span className="text-sm font-medium text-zinc-300">
      <span className="font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
        Learning{" "}
        {profile.target_language}
      </span>{" "}
      · <span className="text-white">{formattedNativeLangs}</span>
    </span>
  );
}
