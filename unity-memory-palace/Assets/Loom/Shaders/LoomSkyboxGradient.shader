// LoomSkyboxGradient — a self-contained three-stop vertical gradient skybox
// for the Resolute workbench. Dark, low-saturation "Quiet Complexity" tones
// are set from MemoryPalaceController; the shader itself has no imported
// textures or dependencies and lives in the Background queue so it is
// swapped via RenderSettings.skybox without touching scene lighting.
Shader "Loom/SkyboxGradient"
{
    Properties
    {
        _Top ("Top", Color) = (0.17, 0.15, 0.13, 1)
        _Horizon ("Horizon", Color) = (0.26, 0.23, 0.19, 1)
        _Ground ("Ground", Color) = (0.11, 0.10, 0.09, 1)
        _HorizonHeight ("Horizon Height", Range(-1, 1)) = 0.1
        _Exposure ("Exposure", Range(0, 8)) = 1
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

            float4 _Top;
            float4 _Horizon;
            float4 _Ground;
            float _HorizonHeight;
            float _Exposure;

            v2f vert (appdata_t v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                // For skyboxes the mesh is a unit cube centered on the camera,
                // so the object-space position is the view direction.
                o.dir = v.vertex.xyz;
                return o;
            }

            float4 frag (v2f i) : SV_Target
            {
                float3 dir = normalize(i.dir);
                float h = dir.y;
                float3 c;
                if (h >= _HorizonHeight)
                {
                    float t = saturate((h - _HorizonHeight) / max(1.0 - _HorizonHeight, 0.0001));
                    c = lerp(_Horizon.rgb, _Top.rgb, t);
                }
                else
                {
                    float t = saturate((_HorizonHeight - h) / max(_HorizonHeight + 1.0, 0.0001));
                    c = lerp(_Horizon.rgb, _Ground.rgb, t);
                }
                return float4(c * _Exposure, 1.0);
            }
            ENDCG
        }
    }
    Fallback Off
}
