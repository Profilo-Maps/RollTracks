# R8 Configuration for React Native
# R8 is the default code shrinker that provides optimization and obfuscation
# These rules ensure React Native and its dependencies work correctly with R8

# ===== React Native Core =====
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep native methods (called from JavaScript)
-keepclassmembers class * {
    native <methods>;
}

# Keep React Native bridge methods
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Keep classes that are accessed via reflection
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers,includedescriptorclasses class * { native <methods>; }
-keepclassmembers class *  { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class *  { @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }

# ===== Hermes Engine =====
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ===== OkHttp (used by React Native networking) =====
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ===== Geolocation Service =====
-keep class com.agontuk.RNFusedLocation.** { *; }

# ===== General Android =====
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes InnerClasses

# Keep crash reporting information
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ===== Optimization Settings =====
# Allow R8 to optimize and obfuscate aggressively
-optimizationpasses 5
-allowaccessmodification
-dontpreverify

# Remove logging in release builds (optional - uncomment to remove logs)
# -assumenosideeffects class android.util.Log {
#     public static *** d(...);
#     public static *** v(...);
#     public static *** i(...);
# }

# ===== Warnings to Ignore =====
-dontwarn com.facebook.react.**
-dontwarn com.google.android.gms.**
-dontwarn java.nio.file.*
-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
