import React, { useRef, useMemo, useState, useEffect, Suspense, useCallback } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Sphere, Stars, Html, Trail, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader } from 'three';

// --- Shaders ---

const globeVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  
  // Calculate world position for interaction
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  // Calculate view position for fresnel
  vec4 viewPosition = viewMatrix * worldPosition;
  vViewPosition = -viewPosition.xyz;
  
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const globeFragmentShader = `
uniform sampler2D uTexture;
uniform float uTime;
uniform vec3 uCursor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

void main() {
    // Texture sample (Topology map: Light = High/Land, Dark = Low/Ocean)
    // We use a texture, but also a backup procedural grid
    vec4 texColor = texture2D(uTexture, vUv);
    float landFactor = texColor.r; 
    
    // Threshold to clearly separate land
    float isLand = smoothstep(0.1, 0.2, landFactor);

    // Create procedural grid pattern
    vec2 gridUv = vUv * vec2(100.0, 50.0);
    vec2 gridFract = fract(gridUv);
    float gridLine = step(0.9, gridFract.x) + step(0.9, gridFract.y);
    gridLine = clamp(gridLine, 0.0, 1.0);

    // Dots pattern - RESTORED
    float dist = distance(gridFract, vec2(0.5));
    float dotShape = 1.0 - smoothstep(0.3, 0.35, dist);
    
    // View direction for Fresnel
    vec3 viewDir = normalize(vViewPosition);
    vec3 normal = normalize(vNormal);
    float viewDot = dot(viewDir, normal);
    float fresnel = pow(1.0 - abs(viewDot), 2.5);
    
    // --- COLOR PALETTE ---
    // Ocean: Dark Blue/Purple
    vec3 oceanColor = vec3(0.02, 0.04, 0.15); 
    // Land: Bright Cyan/Blue (Uniform, Clean)
    vec3 landColorBase = vec3(0.0, 0.4, 0.8);
    vec3 landColorHigh = vec3(0.2, 0.7, 1.0);
    
    // Pulse animation
    float pulse = sin(vUv.x * 12.0 - uTime * 1.5) * 0.5 + 0.5;
    vec3 landColor = mix(landColorBase, landColorHigh, pulse);

    // --- INTERACTION ---
    // Calculate distance from cursor to this fragment in world space
    float cursorDist = distance(vWorldPosition, uCursor);
    float hoverRadius = 1.2; // Radius of influence
    float hoverIntensity = 1.0 - smoothstep(0.0, hoverRadius, cursorDist);
    hoverIntensity = clamp(hoverIntensity, 0.0, 1.0);

    // --- COMPOSITING ---
    vec3 finalColor = oceanColor;
    float finalAlpha = 0.5; // Base visibility

    // Add grid to ocean
    finalColor += vec3(0.1, 0.2, 0.5) * gridLine * 0.15;
    finalAlpha += gridLine * 0.1;

    // Add Land (WITH DOT PATTERN)
    if (isLand > 0.1) {
         float mixVal = isLand * dotShape; // Restored dotShape
         
         finalColor = mix(finalColor, landColor, mixVal);
         // Make land glowing
         finalColor += landColor * mixVal * 0.5;
         
         // Add Interaction Glow (Bright Teal/Cyan)
         vec3 hoverColor = vec3(0.4, 0.9, 1.0);
         // Pulse the hover effect faster than the land pulse
         float hoverPulse = 0.5 + 0.5 * sin(uTime * 8.0);
         finalColor += hoverColor * hoverIntensity * mixVal * (0.8 + 0.4 * hoverPulse);
         
         finalAlpha = mix(finalAlpha, 1.0, mixVal);
    }
    
    // Add Fresnel Rim
    finalColor += vec3(0.3, 0.5, 1.0) * fresnel * 1.2;
    finalAlpha += fresnel * 0.3;

    gl_FragColor = vec4(finalColor, clamp(finalAlpha, 0.0, 1.0));
}
`;

const atmosphereVertexShader = `
varying vec3 vNormal;
void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const atmosphereFragmentShader = `
varying vec3 vNormal;
void main() {
    float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
    gl_FragColor = vec4(0.4, 0.7, 1.0, 1.0) * intensity * 2.0;
}
`;

const auroraVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const auroraFragmentShader = `
uniform float uTime;
varying vec2 vUv;

// Pseudo-random function
float hash(float n) { return fract(sin(n) * 43758.5453123); }

// Periodic Value Noise (Periodic on X)
float noise(vec2 x, float period) {
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f*f*(3.0-2.0*f);
    
    // Periodic X for seamless wrap around the sphere
    float x0 = mod(p.x, period);
    float x1 = mod(p.x + 1.0, period);
    float y0 = p.y;
    float y1 = p.y + 1.0;
    
    // Hash indices
    float n00 = x0 + y0 * 57.0;
    float n10 = x1 + y0 * 57.0;
    float n01 = x0 + y1 * 57.0;
    float n11 = x1 + y1 * 57.0;
    
    float v00 = hash(n00);
    float v10 = hash(n10);
    float v01 = hash(n01);
    float v11 = hash(n11);
    
    float v0 = mix(v00, v10, f.x);
    float v1 = mix(v01, v11, f.x);
    
    return mix(v0, v1, f.y);
}

void main() {
    vec2 uv = vUv;
    float time = uTime * 0.1;
    
    vec3 finalColor = vec3(0.0);
    float totalAlpha = 0.0;
    
    float PI = 3.14159265;
    float noisePeriod = 20.0; // Must match the x-scale used in noiseUV below

    // Generate layers of aurora
    for(float i=1.0; i<=3.0; i++) {
        float t = time * i;
        
        // Calculate frequency for wave - must be integer to wrap seamlessly 0..1
        float freq = 2.0 + i;
        
        // Seamless sinusoidal wave
        float wave = sin(uv.x * 2.0 * PI * freq + t * 0.5) * 0.15 
                   + sin(uv.x * 2.0 * PI * freq * 1.5 - t * 0.2) * 0.05;
        
        // Vertical band position
        float y = uv.y - 0.5 - wave * 0.3;
        
        // Intensity
        float intensity = exp(-abs(y * 6.0));
        
        // Periodic Noise
        // We scale UV.x by noisePeriod so that it wraps perfectly at integer boundaries
        vec2 noiseUV = uv * vec2(noisePeriod, 50.0);
        noiseUV += vec2(t * 2.0, t * 1.0); // Slide noise
        
        float n = noise(noiseUV, noisePeriod);
        
        // Modulate intensity
        intensity *= (0.3 + 0.7 * n);
        
        // Seamless Color Grading
        // Use sin(uv.x...) to ensure start and end colors match
        float colorPhase = uv.x * 2.0 * PI + t * 0.5;
        vec3 c1 = vec3(0.0, 1.0, 0.8); // Teal
        vec3 c2 = vec3(0.6, 0.2, 1.0); // Purple
        
        float mixVal = 0.5 + 0.5 * sin(colorPhase); // 0..1 smooth cycle
        vec3 col = mix(c1, c2, mixVal);
        
        // Add brightness variation
        col *= 1.0 + 0.5 * n;

        finalColor += col * intensity * (0.7 / i);
    }

    // Mask poles to avoid UV pinching artifacts
    float alphaMask = smoothstep(0.0, 0.15, uv.y) * smoothstep(1.0, 0.85, uv.y);
    
    // Output
    gl_FragColor = vec4(finalColor, length(finalColor) * alphaMask * 0.5);
}
`;

const nebulaVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;
void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const nebulaFragmentShader = `
uniform float uTime;
varying vec2 vUv;
varying vec3 vPosition;

// Noise functions
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0 + p.z * 113.0;
    return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                   mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
               mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                   mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}
float fbm(vec3 p) {
    float f = 0.0;
    float w = 0.5;
    for (int i = 0; i < 5; i++) {
        f += w * noise(p);
        p *= 2.0;
        w *= 0.5;
    }
    return f;
}

void main() {
    vec3 pos = normalize(vPosition) * 1.5; 
    float t = uTime * 0.02; // Slow movement
    
    // Multi-layered noise
    float n = fbm(pos + vec3(t, t * 0.5, 0.0));
    float n2 = fbm(pos * 2.0 - vec3(0.0, t, -t));
    
    // Combine
    float cloud = n * 0.6 + n2 * 0.4;
    
    // Colors: Deep Space Purple/Blue
    vec3 c1 = vec3(0.0, 0.0, 0.05); // Very dark base
    vec3 c2 = vec3(0.15, 0.05, 0.3); // Purple
    vec3 c3 = vec3(0.1, 0.3, 0.5);   // Blue/Cyan
    
    // Mix based on noise intensity
    vec3 color = mix(c1, c2, smoothstep(0.2, 0.6, cloud));
    color = mix(color, c3, smoothstep(0.5, 0.9, cloud));
    
    // Add some random "star" dust noise
    float speckle = noise(vPosition * 20.0);
    if (speckle > 0.95) {
        color += vec3(0.5) * (speckle - 0.95) * 10.0 * smoothstep(0.4, 0.6, cloud);
    }
    
    // Alpha falloff
    float alpha = smoothstep(0.2, 0.8, cloud) * 0.5;
    
    gl_FragColor = vec4(color, alpha);
}
`;

// --- Components ---

// Aurora Background Effect
const Aurora = React.memo(() => {
    const shaderRef = useRef(null);

    useFrame(({ clock }) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = clock.elapsedTime;
        }
    });

    return (
        <mesh rotation={[0.4, 0, 0.2]}>
            {/* Sphere geometry enclosing the scene, back side rendered */}
            <sphereGeometry args={[14, 64, 64]} />
            <shaderMaterial
                ref={shaderRef}
                vertexShader={auroraVertexShader}
                fragmentShader={auroraFragmentShader}
                uniforms={{ uTime: { value: 0 } }}
                transparent={true}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.BackSide}
            />
        </mesh>
    );
});

// Nebula Component
const Nebula = React.memo(() => {
    const shaderRef = useRef(null);
    useFrame(({ clock }) => {
        if (shaderRef.current) {
            shaderRef.current.uniforms.uTime.value = clock.elapsedTime;
        }
    });

    return (
        <mesh>
            <sphereGeometry args={[45, 64, 64]} />
            <shaderMaterial
                ref={shaderRef}
                vertexShader={nebulaVertexShader}
                fragmentShader={nebulaFragmentShader}
                uniforms={{ uTime: { value: 0 } }}
                side={THREE.BackSide}
                transparent={true}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </mesh>
    );
});

// Glowing markers on the globe surface
const GlobeMarkers = ({ radius }) => {
    // Fixed prominent cities locations (approx lat/long -> vector3)
    const locations = useMemo(() => {
        const coords = [
            { lat: 40.7, lng: -74.0 }, // NYC
            { lat: 51.5, lng: -0.1 },  // London
            { lat: 35.6, lng: 139.6 }, // Tokyo
            { lat: 22.3, lng: 114.1 }, // Hong Kong
            { lat: -33.8, lng: 151.2 },// Sydney
            { lat: 19.0, lng: 72.8 },  // Mumbai
            { lat: 55.7, lng: 37.6 },  // Moscow
            { lat: -23.5, lng: -46.6 },// Sao Paulo
            { lat: 1.3, lng: 103.8 },  // Singapore
            { lat: 25.2, lng: 55.2 },  // Dubai
            { lat: 37.7, lng: -122.4 },// SF
        ];

        return coords.map(c => {
            const phi = (90 - c.lat) * (Math.PI / 180);
            const theta = (c.lng + 180) * (Math.PI / 180);
            const x = -(radius * Math.sin(phi) * Math.cos(theta));
            const z = (radius * Math.sin(phi) * Math.sin(theta));
            const y = (radius * Math.cos(phi));
            return new THREE.Vector3(x, y, z);
        });
    }, [radius]);

    const markerRef = useRef(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame(({ clock }) => {
        if (!markerRef.current) return;

        locations.forEach((pos, i) => {
            dummy.position.copy(pos);
            const scale = 1.0 + Math.sin(clock.elapsedTime * 3.0 + i) * 0.3;
            dummy.scale.set(scale, scale, scale);
            dummy.lookAt(0, 0, 0);
            dummy.updateMatrix();
            markerRef.current.setMatrixAt(i, dummy.matrix);
        });
        markerRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={markerRef} args={[undefined, undefined, locations.length]}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </instancedMesh>
    );
};

// DigitalGlobe: The main earth mesh with the dot shader
const DigitalGlobe = ({ radius, cursorRef }) => {
    // Reliable high contrast map
    const map = useLoader(TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg');

    const materialRef = useRef(null);

    const uniforms = useMemo(() => ({
        uTexture: { value: map },
        uTime: { value: 0 },
        uCursor: { value: new THREE.Vector3() }
    }), [map]);

    useFrame(({ clock }) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = clock.elapsedTime;
            materialRef.current.uniforms.uCursor.value.copy(cursorRef.current);
        }
    });

    return (
        <group rotation-y={-Math.PI / 2}>
            {/* Main Dot Sphere */}
            <mesh>
                <sphereGeometry args={[radius, 128, 128]} />
                <shaderMaterial
                    ref={materialRef}
                    vertexShader={globeVertexShader}
                    fragmentShader={globeFragmentShader}
                    uniforms={uniforms}
                    transparent={true}
                    side={THREE.DoubleSide} // Ensure it's seen from all angles
                    depthWrite={true}
                    blending={THREE.NormalBlending} // Changed from Additive to Normal for better visibility of "dark" ocean
                />
            </mesh>

            {/* Inner Dark Sphere - Core */}
            <mesh>
                <sphereGeometry args={[radius - 0.05, 64, 64]} />
                <meshBasicMaterial color="#010205" />
            </mesh>

            {/* Atmosphere Glow */}
            <mesh scale={[1.15, 1.15, 1.15]}>
                <sphereGeometry args={[radius, 64, 64]} />
                <shaderMaterial
                    vertexShader={atmosphereVertexShader}
                    fragmentShader={atmosphereFragmentShader}
                    blending={THREE.AdditiveBlending}
                    side={THREE.BackSide}
                    transparent
                />
            </mesh>

            <GlobeMarkers radius={radius} />
        </group>
    );
};

// DataStreams: Arcs flying across the globe
const DataStreams = React.memo(({ radius }) => {
    const maxStreams = 25;

    // Use explicit city points for start/end to make it look like a network
    const cities = useMemo(() => {
        const arr = [];
        for (let i = 0; i < 40; i++) {
            const phi = Math.acos(-1 + (2 * i) / 40);
            const theta = Math.sqrt(40 * Math.PI) * phi;
            arr.push(new THREE.Vector3(
                radius * Math.cos(theta) * Math.sin(phi),
                radius * Math.sin(theta) * Math.sin(phi),
                radius * Math.cos(phi)
            ));
        }
        return arr;
    }, [radius]);

    const streams = useMemo(() => {
        const arr = [];
        for (let i = 0; i < maxStreams; i++) {
            const start = cities[Math.floor(Math.random() * cities.length)];
            let end = cities[Math.floor(Math.random() * cities.length)];
            while (start.distanceTo(end) < 2) {
                end = cities[Math.floor(Math.random() * cities.length)];
            }

            const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            mid.normalize().multiplyScalar(radius * 1.5);

            const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
            const pathPoints = curve.getPoints(40); // More points for smoother curve
            const geometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
            arr.push({
                curve,
                geometry,
                speed: 0.2 + Math.random() * 0.5,
                initialPos: Math.random(),
                color: Math.random() > 0.5 ? '#60a5fa' : '#c084fc'
            });
        }
        return arr;
    }, [cities, radius]);

    const packetRefs = useRef([]);

    useFrame((state) => {
        streams.forEach((stream, i) => {
            const group = packetRefs.current[i];
            if (!group) return;

            const t = (stream.initialPos + state.clock.elapsedTime * stream.speed) % 1;
            const pos = stream.curve.getPoint(t);
            group.position.copy(pos);
        });
    });

    return (
        <group>
            {streams.map((stream, i) => (
                <React.Fragment key={i}>
                    {/* Static Path Line */}
                    <line geometry={stream.geometry} frustumCulled={false}>
                        <lineBasicMaterial color={stream.color} transparent opacity={0.08} />
                    </line>

                    {/* Moving Packet with Trail */}
                    <Trail
                        width={2.5}
                        length={6}
                        color={new THREE.Color(stream.color)}
                        attenuation={(t) => t * t}
                    >
                        <group ref={(el) => (packetRefs.current[i] = el)}>
                            {/* Bright Core */}
                            <mesh>
                                <sphereGeometry args={[0.04, 16, 16]} />
                                <meshBasicMaterial color="#ffffff" toneMapped={false} />
                            </mesh>
                            {/* Outer Glow */}
                            <mesh scale={[2.5, 2.5, 2.5]}>
                                <sphereGeometry args={[0.06, 16, 16]} />
                                <meshBasicMaterial color={stream.color} transparent opacity={0.3} toneMapped={false} blending={THREE.AdditiveBlending} />
                            </mesh>
                        </group>
                    </Trail>
                </React.Fragment>
            ))}
        </group>
    );
});

// Sci-Fi Rings
const GlobeRings = () => {
    const ref = useRef(null);
    useFrame((state) => {
        if (ref.current) {
            ref.current.rotation.z = state.clock.elapsedTime * 0.05;
            ref.current.rotation.x = Math.PI / 2 + Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
        }
    });

    return (
        <group ref={ref} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
                <ringGeometry args={[3.5, 3.52, 64]} />
                <meshBasicMaterial color="#6366f1" opacity={0.1} transparent side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[0.1, 0, 0]}>
                <ringGeometry args={[3.2, 3.22, 64]} />
                <meshBasicMaterial color="#a855f7" opacity={0.05} transparent side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
};

// Interaction Handler
const InteractionHandler = ({ radius, onHover, cursorRef }) => {
    const glowRef = useRef(null);

    useFrame(() => {
        if (glowRef.current) {
            glowRef.current.position.copy(cursorRef.current).multiplyScalar(1.2);
        }
    });

    return (
        <mesh
            onPointerOver={() => onHover(true)}
            onPointerOut={() => onHover(false)}
            onPointerMove={(e) => {
                cursorRef.current.copy(e.point).normalize().multiplyScalar(radius);
            }}
            visible={false} // Hidden mesh for raycasting only
        >
            <sphereGeometry args={[radius + 0.2, 64, 64]} />
            <meshBasicMaterial />
        </mesh>
    );
}

// Wrapper
const GlobeContent = ({ isInteracting, cursorRef }) => {
    const meshRef = useRef(null);

    useFrame((state, delta) => {
        // Constant rotation
        if (meshRef.current) {
            // Even if interacting, keep it rotating slightly or handle interaction
            if (!isInteracting.current) {
                meshRef.current.rotation.y += delta * 0.08;
            } else {
                meshRef.current.rotation.y += delta * 0.01;
            }
        }
    });

    return (
        <group ref={meshRef}>
            <Suspense fallback={
                // Wireframe fallback
                <group>
                    <mesh>
                        <sphereGeometry args={[2.5, 32, 32]} />
                        <meshBasicMaterial wireframe color="#3b82f6" transparent opacity={0.1} />
                    </mesh>
                    <GlobeMarkers radius={2.5} />
                </group>
            }>
                <DigitalGlobe radius={2.5} cursorRef={cursorRef} />
            </Suspense>
            <DataStreams radius={2.5} />
            <GlobeRings />
            <InteractionHandler radius={2.5} onHover={() => { }} cursorRef={cursorRef} />
        </group>
    );
};

// Main
const EarthGlobe = () => {
    const isInteracting = useRef(false);
    const cursorRef = useRef(new THREE.Vector3());

    return (
        <div className="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-auto bg-[#020617]">
            <Canvas
                camera={{ position: [0, 0, 8.5], fov: 40 }}
                gl={{ antialias: true, alpha: false }} // alpha false for better performance and blending against black
            >
                <color attach="background" args={['#020617']} />

                {/* Stronger Lights */}
                <ambientLight intensity={0.8} color="#2e1065" />
                <pointLight position={[20, 10, 20]} intensity={2.0} color="#60a5fa" />
                <pointLight position={[-20, -10, 10]} intensity={1.5} color="#c084fc" />
                <pointLight position={[0, 5, 10]} intensity={1.0} color="#ffffff" distance={10} />

                {/* Deep background elements */}
                <Nebula />
                <Stars radius={300} depth={100} count={10000} factor={6} saturation={0} fade speed={1} />
                <Sparkles count={500} scale={20} size={2} speed={0.4} opacity={0.5} color="#ffffff" />

                {/* Aurora Middle Layer */}
                <Aurora />

                <GlobeContent isInteracting={isInteracting} cursorRef={cursorRef} />

                <OrbitControls
                    enablePan={false}
                    enableZoom={false}
                    enableRotate={true}
                    autoRotate={false}
                    rotateSpeed={0.5}
                    enableDamping={true}
                    dampingFactor={0.1}
                    onStart={() => { isInteracting.current = true; }}
                    onEnd={() => { isInteracting.current = false; }}
                />
            </Canvas>
        </div>
    );
};

export default EarthGlobe;
