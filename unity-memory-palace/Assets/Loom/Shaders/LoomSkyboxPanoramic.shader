// LoomSkyboxPanoramic — an equirectangular HDRI skybox for the Resolute
// workbench. Samples a single latitude-longitude HDR panorama (a Poly Haven
// CC0 asset imported at 2K) and lets MemoryPalaceController mute it to the
// "Quiet Complexity" palette via exposure, tint and saturation. No other
// assets or dependencies; swapped via RenderSettings.skybox.
Shader "Loom/SkyboxPanoramic"
{
    Properties
    {
        _MainTex ("Panorama", 2D) = "white" {}
        _Exposure ("Exposure", Range(0, 8)) = 0.5
        _Tint ("Tint", Color) = (1, 1, 1, 1)
        _Saturation ("Saturation", Range(0, 1)) = 0.5
        _Rotation ("Rotation (degrees)", Float) = 0
    }
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" }
        Cull Off ZWrite Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 2.0
            #include "UnityCG.cginc"

            struct appdata_t { float4 vertex : POSITION; };
            struct v2f { float4 vertex : SV_POSITION; float3 dir : TEXCOORD0; };

            sampler2D _MainTex;
            float _Exposure;
            float4 _Tint;
            float _Saturation;
            float _Rotation;

            v2f vert (appdata_t v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.dir = v.vertex.xyz;
                return o;
            }

            float4 frag (v2f i) : SV_Target
            {
                float3 dir = normalize(i.dir);
                float rad = _Rotation * UNITY_PI / 180.0;
                float c = cos(rad);
                float s = sin(rad);
                dir = float3(c * dir.x - s * dir.z, dir.y, s * dir.x + c * dir.z);

                float2 uv;
                uv.x = atan2(dir.x, dir.z) / (2.0 * UNITY_PI) + 0.5;
                uv.y = asin(clamp(dir.y, -1.0, 1.0)) / UNITY_PI + 0.5;

                float3 col = tex2D(_MainTex, uv).rgb * _Exposure * _Tint.rgb;
                float luma = dot(col, float3(0.299, 0.587, 0.114));
                col = lerp(luma.xxx, col, _Saturation);
                return float4(col, 1.0);
            }
            ENDCG
        }
    }
    Fallback Off
}
