tool: fetch
url: https://docs.orbstack.dev/release-notes
date: 2026-08-22
source: fetch

Contents of https://docs.orbstack.dev/release-notes:
<p>What's new · OrbStack Docs</p>

Skip to content

OrbStack Docs

Appearance

# What's new

Download the latest version

We're hiring!

## v2.2.3 (August 7, 2026)

* New Builds tab for Docker build history, steps, and logs
* SME support on M4 and newer
* UI: Added option to wrap log lines
* UI: Start and stop Supabase CLI stacks with one click
* UI: Fixed Compose projects splitting into multiple groups
* UI: Fixed misleading crash dialog when an external data disk fails
* CLI: Fixed orb push and orb pull for machines, including pushing as root
* CLI: Fixed terminal output being cleared
* CLI: Fixed crashes with non-POSIX login shells (e.g. xonsh)
* USB: Fixed pyserial tools failing to open forwarded serial devices
* USB: Support for Qualcomm modems
* Kubernetes: Fixed network policies not being enforced
* Kubernetes: Fixed high CPU usage
* Kubernetes: Restored CoreDNS Prometheus metrics
* Machines: Better error handling for x86 Alma Linux 10 emulation
* Fixed inbound UDP to host-networking containers (v2.2.2 regression)
* Fixed UDP packets over 1472 bytes being dropped on port forwards
* Fixed machine resource limits being reset if the app crashes
* Fixed ~/.ssh permissions being changed on start
* Fixed app restart loop when installed with Nix Home Manager

## v2.2.2 (August 2, 2026)

* USB: Support for USB webcams, microphones, modems, CAN, Xbox controllers, and audio
* Improved macOS 27 beta compatibility
* Slightly lower idle CPU, memory, and battery usage (especially with Kubernetes)
* Better protection against data corruption, with automatic recovery
* USB: Fixed crashes, stuck devices, and some external drives
* USB: Improved serial device support (CP210x, CDC-ACM, non-root access)
* USB: Better device picker and categories
* UI: Better disk usage bars in storage settings
* UI: Log search can now filter to only matching lines
* UI: Cmd-Delete now asks for confirmation (Cmd-Opt-Delete to skip)
* UI: Fixed delete shortcut conflicting with terminal input
* UI: Fixed Compose projects splitting into multiple groups
* UI: Fixed deleting Compose projects with missing directories
* UI: Fixed terminal not restarting after exit
* UI: Fixed crash when changing machine resource limits
* UI: Fixed missing icons on some containers
* UI: Fixed creating containers with custom commands
* CLI: Fixed command output disappearing after exit
* Fixed microphone not working in machines/containers
* Fixed docker compose run containers taking over domains
* Fixed port forwards to specific IPs on ports under 1024
* Fixed file watchers missing some changes from macOS
* Fixed freezes and "file table overflow" errors on NFS/SMB shares
* Fixed incorrect disk usage on disks over 16 TB
* Fixed file ownership in gVisor (runsc) containers
* Fixed docker login keychain errors
* Fixed Docker containers failing to start inside machines
* Fixed PPP "operation not permitted" error
* Fixed cloud-init reboot and x86 machine timeouts
* Fixed nix-collect-garbage and "Bad fd number" errors in containers
* Fixed crashes when migrating from Docker Desktop
* Fixed Docker hanging when containers restart frequently
* Fixed containers sometimes failing to start after a restart
* Fixed "Start failed" and "timed out waiting for VM to start" errors
* Fixed updater errors and app failing to open after updates
* Fixed rare crashes and freezes
* Kubernetes: Fixed network policies blocking traffic in kind clusters
* Added kernel features: fs-verity, Adiantum
* Updates: Linux 7.0.14, Kubernetes 1.35, runc 1.5.1

## v2.2.1 (June 4, 2026)

* Fixed 127.0.0.1 port forwards not working when host and container port are the same
* Fixed Files tab not working on macOS 15
* Fixed "timed out waiting for VM to start"
* Added support for USB Test & Measurement devices (e.g. oscilloscopes)
* USB stability improvements

## v2.2.0 (June 4, 2026)

* USB device passthrough
  
  + Share serial devices and security keys without disconnecting them from macOS
  + Also supports USB Ethernet, Wi-Fi, SDRs, flash drives, Android phones, and more
* Sound support (playback and recording)
  
  + Use voice mode in Claude Code, Codex, and other tools
* Per-machine CPU, memory, and disk limits
* Fixed most known hangs and crashes
* Docker checkpoint/restore (CRIU) support
* Added buildx Kubernetes driver
* Added option to set the username during onboarding
* Added option for containerd image store (supports multiple platforms with same image tag)
* Improved gVisor (runsc) compatibility
* UI: Storage usage shown as a capacity bar
* UI: Kubernetes init containers are now shown
* UI: Horizontally scrollable logs
* UI: Persist panel widths per tab
* UI: Keep log context while searching
* UI: Prevent log rows from wrapping
* UI: Cmd-Delete to delete selected items
* UI: Fixed terminal apps sometimes not being detected
* UI: Fixed logs reappearing after being cleared
* UI: Fixed sidebar account overlap
* Kubernetes: Configurable API server certificate SANs
* Fixed Docker not working in isolated machines
* Fixed corporate intermediate certificates not being trusted
* Fixed CNAME resolution for local domains
* Fixed no-proxy exclusions not being honored
* Fixed Docker port forwards bound to specific IPs
* Fixed cloud-init user creation
* Fixed resuming interrupted Docker migrations
* Fixed recovering corrupted BuildKit cache
* Fixed UDP port exhaustion under heavy load
* Fixed SSH proxy port conflicts
* Fixed Rosetta wrapper showing in process command lines
* Fixed Docker credential migration errors
* Security improvements to the kernel and file sharing
* More bug fixes and performance improvements
* Updates: Linux 7.0.11, Kubernetes 1.34

## v2.1.3 (May 10, 2026)

* Fixed proxy support breaking cross-container connections
* Fully fixed MongoDB 8 and rseq compatibility issues
* Updates: Linux 7.0.5

## v2.1.2 (May 9, 2026)

* Activity Monitor TUI: orb top
* Fixed Dirty Frag (CVE-2026-43284) privilege escalation
* Isolated machines: Added setting to block network connections to host/machines
* Isolated machines: Opt-in SSH agent forwarding
* Activity Monitor: adjustable update frequency
* UI: Disabled "Hold ⌘Q to Quit" confirmation by default (now behind a setting)
* UI: Refined Liquid Glass app icon
* UI: Fixed machine terminal sessions not restarting
* UI: Fixed toolbar occasionally getting stuck in disabled state
* UI: Fixed wrong info in container stats tab
* UI: Fixed Cmd-H hiding the app from Dock and Cmd-Tab
* Improved support for passing domain names to proxies
* Partial support for socks5h:// proxy URLs
* Potential fix for domains breaking after Compose restart
* Fixed rare crashes caused by invalid network packets
* Fixed empty username in some isolated machines
* Fixed Kubernetes HTTPS port probing in some setups
* Fixed wildcard k8s.orb.local domains
* More complete fix for MongoDB 8 compatibility issues
* Security improvements to authentication and storage
* Updates: Linux 6.19.14

OrbStack was not affected by Copy Fail (CVE-2026-31431) or the recent io\_uring ZCRX vulnerability.

## v2.1.1 (April 20, 2026)

* Fixed MongoDB 8 crashing on v2.1.0
* Selective file sharing mounts in isolated machines
* Per-container Activity Monitor tab
* UI: Sorting options for containers/volumes/images
* UI: Added setting for terminal/logs font size
* UI: Preserve terminal sessions when navigating between tabs
* UI: Allow dots in machine names
* Kubernetes: Fixed CPU and memory metrics
* Kubernetes: Added option to use domain in kubeconfig
* Added http\_port and https\_port configs for machines
* Added dev.orbstack.compose-icon label for Compose projects
* Skip TLS and HTTP probing when dev.orbstack.http-port is set
* Kernel: added tc police action
* Minor performance improvements
* Fixed integrated terminal wrapping/colors
* Fixed isolated machine toggle not applying until restart
* Fixed Activity Monitor always scrolling to selected item

## v2.1.0 (April 19, 2026)

* Liquid Glass UI on macOS 26
* Isolated machines without file system integration
  
  + Useful for AI agent sandboxing
* caffeinate command to prevent sleep in machines
* Setting to bypass proxy for specific hosts
* Support for binding Docker port forwards to IPs other than 0.0.0.0 or 127.0.0.1
* UI: Customizable logs font size
* UI: "Hold ⌘Q to Quit" confirmation
* UI: Custom volume icons via dev.orbstack.icon label
* UI: Kubernetes pod and service labels
* UI: Collapsible pod sections
* UI: Custom proxy URL
* UI: New SQL Server icon
* UI: Better terminal app detection
* Fixed Docker Desktop migration crashes
* Fixed high UDP CPU usage
* Fixed rare race in shared file system
* Fixed multiline Docker domain labels
* Fixed leaking container icon files in cache
* Updates: Kubernetes 1.33, Docker 29.4.0, buildx 0.29.1, Compose 2.30.4, runc, Linux 6.19.13
* New distros: Fedora 43, openSUSE 16, Ubuntu 25.10, Devuan Excalibur

## v2.0.5 (November 21, 2025)

* Fixed issues when using OrbStack machines/containers as VPN servers
* Fixed IP addresses sometimes not showing up
* UI: Fixed xterm-ghostty warnings in some distros
* Updates: Fedora 43, openSUSE 16, Ubuntu 25.10, Devuan Excalibur, Kubernetes 1.33.5, Docker 28.5.2, buildx 0.29.1, Compose 2.30.4, Linux 6.17.8

## v2.0.4 (October 24, 2025)

* Fixed x86 Go programs crashing
* Fixed unreliable WireGuard and other long UDP connections
* Fixed startup crashes on macOS 15.7.x
* Fixed indefinite "Starting" state on some installs
* Updates: Linux 6.17.4

## v2.0.3 (October 2, 2025)

* Fixed TLS errors in emulated x86 programs
* Fixed file system errors and sync issues
* Fixed slow chown -R since v2.0
* Fixed UI sometimes being covered with "App Is In Background" message
* Added switch to disable Docker Engine if only using machines
* Temporarily removed AVX support

## v2.0.2 (September 28, 2025)

* AVX emulation support
* Added dev.orbstack.icon label for custom container icon URLs
* Added volume cloning
* Added port forward firewall settings for security
* Added device-mapper support (LUKS, dm-verity, dm-integrity)
* More graceful container shutdown
* UI: Copyable port numbers
* UI: Resizable log inspector
* UI: Fixed "No Selection" when selecting blank log lines
* UI: Fixed machine terminals opening in the wrong directory
* UI: Fixed occasional terminal-related crashes
* Fixed port forwards not being released
* Fixed upside-down text on macOS 26
* Fixed startup crashes on macOS 15.7
* Fixed "No such file or directory" race in concurrent builds
* Fixed Kubernetes not starting on some machines
* Fixed x86 build and container hangs
* Fixed unnecessary Kubernetes ports being forwarded to macOS
* Fixed Kubernetes failing to mount volumes with colons in path
* Fixed rare "invalid Prefix" crash on start
* Updates: Rocky 10, CentOS 10

## v2.0.1 (August 25, 2025)

* Customizable kubelet config
* Refresh button for volume disk usage
* Added advanced settings to UI
* Fixed freezes and high CPU usage under heavy I/O
* Fixed missing logs toolbar on macOS 26
* Fixed error loading certain networks in UI
* New distros: Alma 10

## v2.0 (August 22, 2025)

* Redesigned UI: OrbStack is now a full-fledged container IDE!
  
  + Fast & powerful terminal powered by Ghostty
  + File manager for containers, volumes, images, machines
  + Fast log viewer with filtering
  + Create containers and networks
  + Detailed container info, icons, and health check status
  + Activity Monitor graphs
* More responsive under high CPU usage
* Slightly faster file system
* More accurate time synchronization
* Customizable IP range for machines and domains
* Many other UI improvements
* Fixed orb.local domains on macOS 26
* Fixed bind mounting /dev into containers
* Fixed "too many open files" on external FAT disks
* Fixed large numbers of port forwards sometimes not working
* Fixed "bad file descriptor" when deleting corrupted machines
* Fixed unusual usernames/group names breaking machine creation
* Support for MPLS and IPv6 segment routing
* Updates: Kubernetes 1.32.6, Docker 28.3.3, Compose 2.39.2, buildx 0.26.1, Linux 6.15.11
* New distros: Debian 14 (testing), Alpine 3.22
* Dropped support for macOS 13

## v1.11.3 (June 7, 2025)

* Shell completions for orb and orbctl commands
* Kubernetes logs UI now supports selecting containers in a pod
* Fixed Docker Engine config getting deleted after closing settings tab
* Fixed cloned/imported machines getting stuck in "provisioning" state
* Fixed dev.orbstack.http-port being overridden by HTTPS
* Fixed orb CLI reporting the wrong version
* Faster machine management operations and UI navigation
* Minor UI improvements
* Updates: Linux 6.14.10

## v1.11.2 (June 3, 2025)

* Fixed occasional crashes since v1.11.0
* Fixed time drift after sleep since v1.11.0
* Activity Monitor: Network stats and graph, disk I/O graph, and totals
* Activity Monitor: Graphs follow selections instead of always showing totals
* New settings UI
* UI: Import and export container images as .tar files
* UI: Improvements to menus, details views, and copyable text boxes
* UI: Pressing Esc will now deselect items in lists
* UI: Fixed icons disappearing in settings
* CLI: orb docker volume import/export commands
* Minor performance improvements
* Updates: Docker 28.2.2, Linux 6.14.9

## v1.11.1 (May 29, 2025)

* Fixed container IPs not working from macOS (domains not affected)
* Fixed container domains and IPs not working from Kubernetes pods
* Fixed orb.local domains not working on new installs
* Updates: Docker 28.2.1

## v1.11.0 (May 28, 2025)

* UI: Activity Monitor for CPU, memory, and disk usage
  
  + Customizable views for containers, machines, and Kubernetes pods
* Volume import and export
* Lower battery drain when Mac is asleep
* SSH support for machine.orb.local domains
* Support for TLS MITM networks in containers
* Support for NVMe over Fabrics (TCP)
* Added descriptions for macOS permission requests
* AVX support to fix "Illegal instruction" errors (when Rosetta is disabled)
* Improved machine import/export
* Increased UDP buffer limits for better QUIC performance
* Security improvements for SSH and macctl
* Added NTSYNC to improve Wine performance
* UI: More volume and image sorting options
* UI: More discoverable buttons for machine and volume actions
* UI: Image names are now shown for some dangling images
* UI: Fixed new machines showing as created too early
* UI: Fixed missing Oracle Linux icon
* Fixed vague privileged helper errors
* Fixed /mnt/machines paths not being translated when running macOS commands in machines
* Fixed rare crashes when connecting to domains concurrently
* Fixed unnecessary Local Network permission requests
* Fixed hang when exposing engine to local network over TCP
* Fixed Alpine machine creation on MITM networks
* Fixed domain and displayed names for docker compose run containers
* Fixed permission issues when running macctl commands in machines (custom users must be added to the orbstack group)
* Fixed UDP port forwards sometimes not working
* Links now point to our new orb.cx link shortener
* Updates: Docker 28.1.1, Kubernetes 1.31.6, runc 1.3.0, Compose 2.36.2, buildx 0.24.0, credential-helpers 0.9.3, Linux 6.14.8
* New distros: Ubuntu 25.04, Fedora 42, NixOS 25.05, openEuler 25.03

## v1.10.3 (March 17, 2025)

✨ Please spread the word if you like OrbStack!

* Fixed hang on M3 Ultra
* Fixed several crashes
* Fixed missing x86\_64-v2 support in some cases
* Fixed sign-in not respecting proxy settings
* Updates: Linux 6.13.7, buildx 0.21.2

## v1.10.2 (February 20, 2025)

* Fixed fish init script being added to zsh profile

## v1.10.1 (February 19, 2025)

* Enterprise: MDM support for OrbStack and Docker engine settings
* CLI: orb update --check command for automated update checks
* Domains: Fixed dev.orbstack.http{,s}-port labels not being respected
* UI: Fixed app not being focused when opening windows from menu bar
* UI: Fixed machine terminals starting in a temporary directory
* UI: Fixed diagnostic reports sometimes failing to upload
* Updates: Linux 6.12.15, buildx 0.20.1

## v1.10.0 (February 14, 2025)

* Domains: Better HTTP(S) server port selection
* Machine importing and exporting
* Machine cloning
* Instant machine cloning and deletion (on new installs)
* Instant machine disk usage calculation (on new installs)
* Domains: Connections from containers will now get trusted certificates
* Fixed loop devices sometimes not appearing
* Fixed occasional SQLite I/O errors on bind mounts
* Support for HTB and more packet schedulers
* UI: Menu item to copy container names
* Updates: Docker 27.5.1, Linux 6.12.13

## v1.9.5 (January 21, 2025)

* Fixed incorrect Compose version string
* Fixed Kubernetes ingress certificate not being trusted in some browsers
* Fixed several Docker Desktop migration bugs
* Updates: Compose 2.32.4, Linux 6.12.10

## v1.9.4 (January 14, 2025)

* Better error handling for Migration Assistant corruption
* Compatibility with Ruby and JetBrains Fleet SSH
* Fixed Docker Desktop migration randomly appearing
* Fixed /var/run/docker.sock permissions
* Fixed k8s.orb.local domain not working in pods
* Fixed file system permission and synchronization issues
* Fixed Podman and Docker in emulated x86 machines
* Fixed certificate error 25300 on some systems
* Fixed docker compose run --remove-orphans not working
* Updates: Kubernetes 1.30.7, Docker 27.4.1, Compose 2.32.3, Linux 6.12.9

## v1.9.2 (December 17, 2024)

* Fixed Elasticsearch 7.x and older OpenJDK crashing with NullPointerException
* Better error handling when installing command-line tools
* Updates: Linux 6.12.5

## v1.9.1 (December 13, 2024)

* Fixed crashes under some usage patterns
* Fixed some CLI commands not failing when given invalid arguments
* orb.local index page now uses HTTPS links for machines
* Security: container/machine data is now protected by macOS sandbox
* Additional security improvements for file sharing
* Updates: Alpine 3.21, Linux 6.12.4

## v1.9.0 (December 9, 2024)

* Debug Shell: Support for debugging remote Docker containers (Preview)
* Certificates for orb.local domains are now trusted in containers
* Confirmation step before uploading diagnostic reports
* Fixed data image growing unexpectedly
* Debug Shell: Fixed builtin package conflict handling
* Support for SCTP port forwards between containers
* Fixed Kubernetes IPv6 DNS issues
* Fixed some port forwarding errors
* Fixed rare freezes on shutdown
* Fixed ngrok not working with orb.local domains as upstream
* Fixed untrusted Kubernetes ingress certificates
* Fixed net.core.{r,w}mem sysctls
* Support for CIFS extended attributes and POSIX ACLs
* Hardened file sharing permissions on multi-user systems
* Updates: NixOS 24.11

## v1.8.2 (November 19, 2024)

* UI: Added Logs button to Compose project details
* UI: Fixed broken sidebar after reopening window on macOS 15.1
* UI: Fixed duplicate windows in some cases
* UI: Fixed error messages when service stops
* UI: Fixed container sorting in Compose projects
* Support for perf and other tools in Ubuntu
* Fixed rare crash on start
* Fixed automatic HTTPS occasionally not working
* Updates: buildx 0.18.0, runc 1.2.2, Linux 6.11.9

## v1.8.1 (November 10, 2024)

* Domains: Auto HTTPS for Kubernetes ingress controllers
* Domains: Containers with HTTPS servers will now get valid certificates
* Domains: Minor performance improvements
* Domains: Fixed IPv4-only servers not working in machines
* Domains: Fixed servers sometimes not working after container restart
* Domains: Fixed docker pull from local registries
* Support for symlinking /var/run/docker.sock when running as non-admin user
* Fixed new installs crashing on macOS 13
* Fixed port forward instability under concurrent load testing
* Machines: Fixed custom CA certificates not being used on some distros
* Updates: Fedora 41, runc 1.2.1

## v1.8.0 (November 3, 2024)

* Debug Shell: Support for debugging stopped containers
* Debug Shell: Support for debugging images
* Domains: Auto container-to-container HTTPS proxy
* Domains: Auto HTTPS for machines
* macOS 15 optimizations and compatibility improvements
* Fixed domains sometimes pointing to the wrong container
* Fixed domains not connecting from some containers/machines
* Fixed loopback devices in privileged containers
* Fixed copying files to macOS container bind mounts using Finder
* Faster eBPF tracing startup time
* SCTP support (excluding internet)
* Updates: Ubuntu 24.10, OpenEuler 24.09, Linux 6.11.5
* Removed support for macOS 12

## v1.7.5 (October 4, 2024)

* Compatibility with some non-compliant MITM certificates
* UI: "Start on login" no longer opens a window
* UI: Fixed long errors covering the window
* UI: Better error messages when data is inaccessible
* Fixed new machines not appearing in shared macOS folder
* Fixed error when bind mounting a file onto a bind mount
* Fixed NixOS unstable machine creation
* Fixed machine creation error when attempting to start a shell too quickly
* Fixed emulated x86 machines not starting when Rosetta is disabled
* Fixed IP conflicts in Compose networks
* Fixed crash on early macOS 15 betas
* Fixed memory leak when accessing container files from macOS
* Added support for ublk
* Updates: Docker 27.3.1, buildx 0.17.1, Compose 2.29.7, Linux 6.10.12

## v1.7.4 (September 24, 2024)

* Debug Shell: Command to reset installed packages/data
* Kubernetes: net.\* sysctls are now allowed
* Shell profile and SSH config will now only be edited once
* Fixed window sometimes not opening on macOS 15
* Fixed inaccurate CPU features in emulated x86 machines
* Fixed kernel modules not being detected in some machines
* Fixed traceroute not working on some servers
* Fixed special characters in NixOS usernames
* Fixed migration errors not showing in UI
* Other macOS 15 compatibility improvements
* Updates: Linux 6.10.11

## v1.7.2 (September 3, 2024)

* Fixed hard links on bind mounts (fixes PostgreSQL issues and more)
* Fixed networking in multi-node kind clusters

## v1.7.1 (September 2, 2024)

* General 5–20% performance improvements
* More power-efficient networking
* Added FOU and IP tunnel support
* Better memory management on low memory
* Increased /dev/shm size for compatibility
* UI: Multi-selection for machines
* Fixed occasional crashes on start
* Fixed rare freezes under heavy I/O
* Fixed Kubernetes pod-to-service networking issues
* Fixed Kubernetes-related crashes
* Updates: Docker 27.1.2, Compose 2.29.2, Linux 6.10.7

## v1.7.0 (August 22, 2024)

Memory usage is (finally) a solved problem!

📕 Read the blog post

* Dynamic memory: lower memory usage
  
  + Memory is auto-released when no longer used
  + Works with running containers and machines!
* Up to 4x faster disk I/O
* Many other performance improvements, e.g. for CPU-bound workloads
* Network: Lower CPU usage and better performance
* Better DNS error handling
* Debug Shell: UX improvements for dctl command
* Fixed file system contents not updating on some machines
* Fixed several high CPU usage and stability issues
* Fixed "key not found" error on some new installs
* Fixed memory leak on failed network connections
* Fixed Puppeteer crash
* Fixed unusual SSH terminal modes
* Fixed error when deleting machines with subvolumes
* Added IP\_VS\_MH scheduler
* Updates: Linux 6.10.5, buildx 0.16.3

## v1.6.4 (July 10, 2024)

v1.6.4 (17192) is a hotfix for v1.6.4 (17187).

* General CPU performance improvements
  
  + Up to 5x for compute-bound workloads on M1
* Debug Shell: AI-powered package install suggestions for commands
* HTTP port redirection when using orb.local domains from containers
* UI: Sort images and volumes by size
* Up to 75% faster network in Docker containers
* More clear machine creation errors
* Better support for removing SSH config and zshrc changes
* Added kernel features: bcachefs, IFB, bonding
* Fixed errors with large PostgreSQL databases
* Fixed service sometimes not auto-starting on login
* Fixed menu bar icon pulsing after service is stopped from CLI
* Fixed "machine not found" after deleting default machine
* Fixed update notifications when app isn't running
* Fixed locale issues in new machines
* Fixed potential CPU/memory issues with Kubernetes networking
* Updates: NixOS 24.05, openSUSE 15.6, openEuler 24.03, buildx 0.15.1, Linux 6.9.8

## v1.6.3 (June 26, 2024)

* Fixed several file system bugs
* Lower CPU usage under high network load
* Significantly faster IPv6 networking
* Compatibility check for Haswell and Broadwell CPUs
* Prefer container commands over Debug Shell packages
* Fixed volume size errors when deleting volumes quickly
* Fixed light/dark theme not updating in update prompt
* Fixed rare crashes after sleep/wake with long uptime
* Fixed swapoff in machines
* Updates: Compose 2.27.3, Linux 6.9.6

## v1.6.2 (June 12, 2024)

* Compatibility fixes for macOS 15 Developer Beta
* Lower memory usage when accessing many files
* Revamped configuration for new NixOS machines
* Fixed "No such file or directory" when macOS changes files quickly
* Fixed file watchers not working in some cases
* Fixed wrong error being shown when service crashes on start
* Fixed temporary 8 GB file being included in backups
* Fixed user management and locale issues in NixOS machines
* Kubernetes: Fixed IPv6 ingress controller bug
* Debug Shell: Support for Ghostty and Contour
* Debug Shell: Fixed missing PATH in some containers
* Debug Shell: Minor fixes for shell environment and compatibility
* UI: Support for opening Ghostty and more new terminals
* Updates: Docker 26.1.4, Linux 6.9, Compose 2.27.1, buildx 0.14.1, docker-credential-helpers 0.8.2, Alpine 3.20

## v1.6.1 (May 28, 2024)

* Potential fix for crashes on Intel 4th/5th generation CPUs
* Added check for unsupported Intel CPU generations
* File system: Slightly faster read/write on shared file system
* File system: Fixed directory listing bug affecting some programs
* Fixed crash when memory limit is invalid
* Fixed some Rosetta shared memory bugs

Hackintoshes with Intel CPUs newer than 10th generation (the newest Apple has ever shipped in an Intel Mac) are no longer supported.

## v1.6.0 (May 22, 2024)

* True near-native file system performance: 2–10x faster
* New virtualization engine: faster and more stable
* General performance improvements for CPU, network, disk
* More reliable file sharing, including on external volumes
* Fixed crashes, freezes, and other stability issues
* Fixed potential data corruption on hard shutdown
* Fixed permissions on ~/OrbStack machine files
* Fixed Docker credential store on new installs
* Fixed Docker API hangs with some PHP clients
* Fixed missing locales in some Linux machines
* Fixed DNS resolution with over 5 CNAMEs (e.g. Azure OpenAI)
* UI: Badge for emulated images (e.g. amd64)
* UI: Easy access to Compose YAML files
* UI: Logs will no longer scroll while reading past logs
* Debug Shell: Improved compatibility with unusual container setups
* Kubernetes: Added k8s.orb.local to server certificate
* Time Machine backup exclusion to prevent issues on HFS+
* Updates: Kubernetes 1.29.3, Ubuntu 24.04, Fedora 40, Linux 6.7.12

## v1.5.1 (April 1, 2024)

* Downgraded xz to fix potential security issues
  
  + OrbStack was not vulnerable to CVE-2024-3094
* Confirmation prompt for deleting containers
* Fixed Rosetta installation request even if disabled
* Fixed old NixOS machines failing to upgrade
* Fixed old SQL Server crashing with SIGABRT
* Fixed button tooltips not appearing on hover
* Debug Shell: Removed warning when working directory doesn't exist
* Debug Shell: Colorful ip output

## v1.5.0 (March 21, 2024)

* New: OrbStack Debug Shell
  
  + Useful commands & tools to easily debug any container (even minimal/distroless/read-only)
  + Install over 80,000 packages
  + Everyone has a free 30-day Pro trial for Debug Shell
* Faster & more reliable access to container/image/volume/machine files
* Fixed OrbStack starting automatically with VS Code C++ extension
* Fixed invalid hosts in VS Code Remote SSH sidebar
* Fixed crash on some unexpected network packets
* Fixed deletion of machines with swapfiles
* Fixed "No space left on device" and related crashes
* Fixed shared folder name on macOS 14.4
* Fixed new machine creation for NixOS unstable
* General performance improvements
* UI: Compose groups stay expanded across restart
* UI: Support for multiple containers in Kubernetes pod logs
* UI: Gray dot for paused containers
* UI: Consistent location for container actions
* UI: Fixed error dialogs not fitting on screen
* UI: Fixed high CPU usage when errors occur in the background
* CLI: -w flag for working directory
* Kernel features: TIPC, conntrack zones (support for Kuma)
* Machines: support for CRIU
* Fixed CVE-2024-29018
* Updates: Docker 25.0.4, buildx 0.13.1, Linux 6.7.10, openEuler 23.09

## v1.4.3 (February 13, 2024)

* Full fix for CVE-2024-21626
* Fixed app sign-in sometimes not working
* Updates: Docker 25.0.3

## v1.4.2 (February 6, 2024)

* Support for bind-mounting non-standard macOS paths
* Fixed UI incorrectly showing "Personal use only" in some cases
* Fixed some images with extended attributes failing to import
* Fixed incorrect error messages when image import fails
* Fixed mounting SSH\_AUTH\_SOCK into containers

## v1.4.1 (February 2, 2024)

* Minor UI tweaks
* Fixed missing command-line tools in some installs
* Fixed SSH config parsing errors

## v1.4.0 (February 2, 2024)

* High severity security fixes for Docker Engine, runc, BuildKit
* New UI design to show more details
* Shell completions for docker and kubectl
* orb.local domains now work across Compose projects
* Create machines with custom usernames
* Change default username for each machine
* Added X-Forwaded-For to HTTPS proxy
* Support for multi-level wildcard domains
* Fixed some ANSI escapes appearing in logs
* Fixed unnecessary Kubernetes restarts
* Fixed Rosetta install process

## v1.3.0 (December 28, 2023)

* Cloud-init for Linux machines
  
  + Easily replicate & test environments with user data, like EC2
* Kubernetes cluster.local domains
  
  + Allows connecting to headless services
* Smoother migration from Docker Desktop
* Advanced setting to change Docker Swarm node name
* Advanced setting to expose SSH server to LAN
* Fixed compatibility with JetBrains Docker plugins
* Fixed emulated Arch x86 machines on Apple Silicon
* Fixed unreliable domains on newer macOS 14 releases

## v1.2.0 (December 20, 2023)

📕 Read the blog post

* Native container files access from Finder & Terminal
  
  + View & edit files in containers with your favorite tools
* Added option to disable wrapping in logs UI
* Added support for vhost-net
* Fixed complex volume migration from Docker Desktop
* Fixed DNS memory leak and high CPU usage
* Fixed file watchers not working in /tmp
* Fixed host connections timing out under high load
* Fixed IPv6 compatibility issues with some containers
* Fixed Kubernetes DNS crashing under heavy load
* Fixed rare SSH connection failures
* Fixed rebuilt image contents not updating on macOS side
* Fixed Yarn, AppImages, and Swift under x86 emulation
* Support for connecting to any port via HTTP proxy
* Support for emulating RISC-V, PowerPC, MIPS, and IBM Z
* Updates: Compose 2.23.3, buildx 0.12.0, Linux 6.5.13

## v1.1.0 (November 16, 2023)

📕 Read the blog post

* Automatic HTTPS for containers & services
  
  + Secure, zero-setup HTTPS for all domains
* Better x86 performance on macOS 14.1+
* Copyable port numbers in container info
* Machines can now be started from the menu bar
* Better credential store coexistence with Docker Desktop
* Fixed DNS memory leak in some error cases
* Fixed crash when switching tabs quickly
* Fixed VS Code not connecting in new Alma machines
* Updates: Docker 24.0.7, Linux 6.5.10, Ubuntu 23.10, Fedora 39, Debian 13 (testing)
* Other bug fixes and improvements

## v1.0.1 (October 12, 2023)

* Fixed x86 programs crashing on macOS 14 Sonoma
  
  + Workaround for Apple bug
* Remaining Pro (commercial) trial days are now shown in the app
  
  + Request an extension if needed
* Separate UI sections for in-use/unused/dangling images
* Support for opening Warp terminal
* Support for GENEVE tunnels
* NAT traversal fixes for Tailscale
* More reliable traceroute
* Fixed migration getting stuck and failing on some containers
* Fixed OrbStack app preventing shutdown/restart
* Fixed uppercase domain names not working
* Fixed some memory leaks
* Updates: Compose 2.22.0, Linux 6.5.7
* Other bug fixes and improvements

## 🎉 v1.0 (September 21, 2023)

### OrbStack 1.0 is here

It's the long-awaited release! See the blog post

Licenses are now required for freelance, business, and commercial use.

### Other changes since beta

* Default update channel is now Stable
* For faster updates, opt in to Canary in Settings
* Better handling of domain name conflicts
* Fixed service occasionally getting stuck while stopping
* Fixed shared volumes disappearing in rare cases
* Compatibility fix for IBM DB2
* Other bug fixes and improvements

### Hotfix 16230

* Fixed issues with accounts and licenses when updating from beta

## v0.17.3 (September 13, 2023)

* Fixed GUI getting stuck on "Loading" in some cases
* Fixed Rosetta installation on new Macs
* Fixed crash on start when disk is almost full
* Higher maximum memory limit on high-RAM Macs
* Faster startup with lower CPU usage
* Updates: Linux 6.4.16
* Other bug fixes and improvements

## v0.17.2 (September 11, 2023)

* Faster and more stable UI
* Filter Compose project logs to a set of services
* Start containers & projects from the menu bar
* Simple switch to start and stop Kubernetes
* More menu bar features & actions
* Slightly lower memory usage
* More reliable updating and restarting
* Fixed domains not working in some cases
* Fixed some web frameworks not reloading on file changes
* Fixed rare freezes under high I/O
* Fixed occasional UI crashes
* Updates: Docker Engine 24.0.6, Linux 6.4.15
* Other bug fixes and improvements

## v0.17.1 (August 31, 2023)

* One-click button to open Kubernetes services in browser
* Faster start/stop/delete actions in GUI
* Fixed port forwarding issues
* Potential stability improvements under high I/O
* Support for CAN bus (SocketCAN and virtual CAN)
* Support for IPVLAN and IPIP tunnels
* Support for bind-mounting /opt/homebrew
* Updates: Compose 2.21.0, Linux 6.4.13
* Other bug fixes and improvements

## v0.17.0 (August 29, 2023)

* First-class Kubernetes support
  
  + Seamless network: Connect to pods, ClusterIPs, Ingress directly
  + Battery friendly: Up to 80% less power usage
  + Native macOS UI
* More reliable container domains
* More efficient container port forwards (up to 30% less CPU)
* General system performance improvements
* Security improvements against malicious machines
* FIPS support for builtin SSH server (ECDSA and RSA)
* Fixed container logs UI on macOS 12
* Updates: Linux 6.4.11, Devuan 5
* Other bug fixes and improvements

## v0.16.1 (August 17, 2023)

* Direct access to container image files from Mac
  
  + Explore Docker images with Finder and other tools
* Helper tool to avoid asking for password more than once
* Better port detection for container domains
* Option to stop requesting admin privileges
* Offline licensing support for up to 7 days
* Fixed some self-signed certificates not being trusted
* Fixed new machines not showing up in /mnt/machines
* Rosetta bug fixes
* Updates: Linux 6.4.10
* Other bug fixes and improvements

## v0.16.0 (August 10, 2023)

* Automatic domain names for containers
  
  + Zero config, no port numbers needed
  + Support for custom domains and wildcards
* New logs UI with search and tabs for Compose projects
* Added button to reset data from settings UI
* Better network compatibility
* Fixed segfaults in some emulated x86 builds
* Fixed migration for some x86 containers and images
* Fixes for build cache cleaning and SSH agent forwarding
* Fixed emulated Arch Linux machine creation
* Support for mounting localtime in containers
* Updates: Linux 6.4.8
* Other bug fixes and improvements

## v0.15.1 (July 30, 2023)

* Automatic deletion of unused build cache (can save 200+ GB)
* Faster Docker shutdown and machine deletion
* More reliable file watcher & live reload support
* Minor performance improvements for some workloads
* Added option to leave Docker context unchanged
* Support for emulating AVX (when Rosetta is off)
* Fixed migration from older versions of Docker Desktop
* Fixed modprobe errors (for Istio, K3s, etc.)
* Fixed rare storage-related startup errors
* Fixed freezes under some heavy UDP workloads
* Fixed compressed executables failing under Rosetta
* Updates: Docker 24.0.5, Linux 6.4.7
* Other bug fixes and improvements

## v0.15.0 (July 23, 2023)

* Automatic data migration from Docker Desktop (containers, etc.)
* Send feedback from the app
* Simplified bug reporting
* More reliable port forwarding
* Better support for proxy exclusions (domains, IP subnets)
* Fixed PHP segfaults under Rosetta
* Fixed timeouts when accessing Docker volumes from Mac
* Fixed occasional crashes when running Chromium
* Fixed Alpine and Void creation with unusual usernames/UIDs
* UI fixes, design tweaks, silent notifications
* Updates: Debian 12, Compose 2.20.2, Linux 6.3.13
* Other bug fixes and improvements

## v0.14.1 (July 12, 2023)

* Fixed Docker not starting if updating with too many Compose networks
* Fixed stability issues and file sharing crashes
* Fixed repeated admin prompts on new Macs
* Fixed hostname in new Ubuntu machines
* Fixed "Operation not permitted" on bind-mounted devices
* Fixed missing HOME environment for non-existent container UIDs
* NixOS builder support for x86\_64 on Apple Silicon

## v0.14.0 (July 10, 2023)

All about performance and power saving.

* Faster bind mounts with caching and optimizations
  
  + 3x faster search, 20x faster git status
* 2x faster container start/stop
* Lower energy usage when running heavy services and containers (up to 10x)
* Fixed Node.js programs (e.g. pnpm) freezing under Rosetta
* Better performance when macOS host is under load
* Faster builds for Dockerfiles with many steps
* Support for running 32-bit ARM programs
* Support for renaming machines
* Changed IP ranges to minimize conflicts
* Fixes for bind mounts and other I/O
* Updates: Docker 24.0.4, Compose 2.19.1, Linux 6.3.12
* Other bug fixes and improvements

## v0.13.0 (June 25, 2023)

A renewed focus on performance and stability.

* Faster app start/stop and updating (up to 5x)
* 2x faster container start/stop
* Fixed most common Rosetta bugs
  
  + If you've disabled it, turn it back on to run x86 containers faster
* Standard Docker IP ranges for compatibility (fixed SSL/authentication issues)
* Better handling of IP conflicts with VPNs
* Support for moving data to external drive
* More reliable setup process
* More resilient to power loss
* Out-of-memory notifications
* Support for running full x86 Docker engine with Rosetta
* Fixed some complex Docker Compose setups getting stuck
* Updates: Linux 6.3.9, Docker Compose 2.19.0
* Other bug fixes and improvements

## v0.12.0 (June 16, 2023)

* Connect to Docker containers directly by IP address
  
  + Seamless bridge networks, no port forwarding needed
* Connect to Linux machines by IP address (bridge network)
* Log viewer improvements
* Support for all CPU cores on M2 Ultra
* Better UI performance with many containers/volumes/images
* Fixed port forwards failing after Docker or machine restart
* Fixed crashes after customizing toolbar
* Updates: Linux 6.3.8, Docker 24.0.2, buildx 0.11.0, openSUSE 15.5
* Bug fixes and other improvements

## v0.11.3 (June 7, 2023)

* Support for macOS 14 Sonoma Developer Beta (fixed crash)
* SSH server: Support for adding authorized keys
* Support for legacy docker.for.mac.localhost host
* Updates: Linux 6.3.6, NixOS 23.05, Alpine Linux 3.18
* Bug fixes and other improvements

## v0.11.2 (June 1, 2023)

* Added openEuler distro for machines
* Added support for custom Docker hosts (e.g. port 2375)
* Fixed excessive service restarts and updates
* Fixed disabled "Apply" button in settings
* Other bug fixes

## v0.11.1 (May 29, 2023)

* Menu bar status indicators for Compose services
* Support for running commands in shell with -s
* Better handling of out-of-memory scenarios
* Fixed file watching on advanced volume-style bind mounts
* Fixed occasional permission issues on write-intensive mounts
* Fixed occasional AOSP build failures
* Menu bar & updater fixes
* Updates: Linux 6.3.4
* Bug fixes and other improvements

## v0.11.0 (May 23, 2023)

* Menu bar app with quick actions
  
  + Manage containers & machines from anywhere
* Hide icon from Dock
* Discord community for feedback & help
* Redesigned onboarding for new users
* Better Docker UI design and usability
* Simpler background service management
* Updates: Docker Compose 2.18.1, buildx 0.10.5, Linux 6.1.29
* Bug fixes and other improvements

## v0.10.2 (May 15, 2023)

* Fixed IPv6 UDP port forwarding
* Fixed UDP servers in Docker host networking mode
* Fixed UDP flows stopping after long periods of inactivity
* Fixed GUI actions for invalid Docker Compose projects

## v0.10.1 (May 10, 2023)

* Distro version picker UI for Linux machines
* Docker Compose projects are now shown above other containers
* Better errors in Docker UI
* Faster loading of long container log history
* Fixed actions for deleted Compose projects
* Fixed filtering for only running containers
* Updates: Docker 23.0.6
* Bug fixes and other UI improvements

## v0.10.0 (May 7, 2023)

Even more GUI features!

* Docker container logs
* Docker Compose project groups in UI
* Batch actions (multi-select) for containers, images, and volumes
* Skip confirmation with Option-click
* Distro updates: Ubuntu 23.04, Fedora 38
* Bug fixes and other UI improvements

## v0.9.0 (May 4, 2023)

Lots of work on the GUI app this time, with more to come!

* Docker image management UI
* Docker container, image, and volume search
* Docker volume sizes and creation dates
* Streamlined Docker container menus
* Added option to hide "OrbStack" volume from Finder
* Lower CPU usage after deleting a lot of files
* Fixed system-wide HTTPS proxy support
* Fixed delayed Docker UI updates in some cases
* Bug fixes and other UI improvements

## v0.8.1 (May 1, 2023)

* New Docker config GUI
* Live refresh for Docker GUI
* Disabled Docker IPv6 by default for compatibility
* Fixed permission errors when writing many small files as non-root users
* Fixed occasional false-positive file watch creation events
* Updates: Docker 23.0.5, Linux 6.1.27

## v0.8.0 (April 26, 2023)

* File watching & live reload support for Docker bind mounts
* Faster network and better compatibility (up to 48 Gbps on M1)
* Support for emulated arm64 Docker containers on Intel
* Opt-in environment variable forwarding for machines
* Support for Docker Swarm and Kubernetes IPVS
* Fixed occasional "Failed to start VM" errors in UI
* Fixed systemd distros in emulated Intel machines on macOS 12
* Updates: Docker 23.0.4, Linux 6.1.26
* Bug fixes and improvements

## v0.7.2 (April 19, 2023)

* Fixed Docker UDP port forwarding for reply packets
* Don't change shell profile if PATH is already set correctly

## v0.7.0, v0.7.1 (April 17, 2023)

* Minor file sharing performance improvements for small files
* 2-way localhost integration in Docker host networking mode
* Faster Docker and machine shutdown
* binfmt support for running macOS executables directly from Linux
* Fixed load testing with many concurrent connections at once
* Fixed Docker bind mounts in $TMPDIR
* Fixed compatibility issues with ufw
* Bug fixes and improvements

v0.7.1 is a stability hotfix for v0.7.0.

## v0.6.2 (April 8, 2023)

* Full support for eBPF tracing (bcc, bpftrace, etc.)
* 20% faster startup
* Slightly lower background CPU usage
* Fixed custom Docker 20.10 instances with privileged containers

## v0.6.1 (April 7, 2023)

* Docker & Linux will now use the macOS certificate store
  
  + Includes self-signed CA certificates and Docker certs.d
* Added support for disabling automatic proxy
* Added support for Istio (Kubernetes service mesh)
* Added syscall tracepoints and tracefs
* Improved startup reliability
* Fixed issues with localhost HTTP(S)\_PROXY environment from macOS
* Updates: Docker 23.0.3, Linux 6.1.23
* Bug fixes and improvements

## v0.6.0 (April 3, 2023)

* Automatic HTTP/HTTPS/SOCKS proxy for Docker and Linux traffic
* Added support for editing Docker engine config
* Added support for limiting CPU usage
* Added orb logs command to view Docker and machine logs
* Fixed access to Docker volumes with strict permissions
* Fixed host-gateway as extra host
* Fixed unexpected shutdowns when using a proxy
* Smoother uninstall flow
* Updates: Linux 6.1.22
* Bug fixes and improvements

## v0.5.2 (March 29, 2023)

* Fixed most "Failed to get machines" errors (complete fix in progress)
* Docker: Fixed localhost issues with IPv4-only servers
* Linux: Fixed passwordless sudo for usernames containing periods
* Linux: Fixed missing macOS tools in PATH with some non-default shells
* Removed lnx and lnxctl command aliases
* Stricter permissions on ~/OrbStack
* Updates: Docker 23.0.2
* Bug fixes and improvements

Interim release with lots of small bug fixes. More work to improve GUI reliability and usability is in progress.

## v0.5.1 (March 26, 2023)

🚀 Announcing public beta!

* More reliable machine creation and management
* Breaking change: Moved SSH server to port 32222 to avoid conflicts
* Docker Desktop CLI tools will now be replaced during setup
* Added support for keeping Docker disabled
* Better behavior when there's no network connection
* Fixed setup with some shells and Active Directory environments
* Updates: Linux 6.1.21, Docker Compose 2.17.2
* Bug fixes and improvements

## v0.5.0 (March 20, 2023)

* Full-blown Docker GUI
* Breaking change: Moved Docker & Linux mounts to ~/OrbStack for clarity
* Added support for Cilium and eBPF development
* Added support for systemd user services
* Added 32-bit x86 emulation on Apple Silicon
* Starting Linux shells is now significantly faster
* Updated to Linux 6.1.20
* Bug fixes

## v0.4.0 (March 15, 2023)

* All-new comprehensive documentation, hot off the press
* Added docker.internal for connecting to Docker from Linux machines
* Finished dynamic disk size implementation (now reflected in df)
* Changed IPv6 subnet to better comply with RFC
* Improved uninstall flow
* Updated to Linux 6.1.19
* Added support for AF\_XDP sockets
* UI tweaks
* Bug fixes

## v0.3.1 (March 9, 2023)

* Added examples for getting started with Docker
* Added slower fallback for Rosetta on macOS 12
* Fixed empty window when re-opening app with collapsed sidebar
* Fixed Docker bind mounts under /tmp
* Fixed WebAssembly segfaults on 2020 Intel Macs
* Other bug fixes

## v0.3.0 (March 5, 2023)

* Major stability and reliability improvements
* Linux and Docker data now appears under “OrbStack” in Finder
* Significantly faster networking in Docker containers
* Updated to Linux 6.1.15
* Added restart command
* Fixed occasional "VM did not start" errors on first launch
* Other bug fixes and improvements

## v0.2.1 (February 28, 2023)

* Fixed machine creation with RHEL-based distros
* Fixed command-line tool setup with iTerm shell integration
* Workaround for rare errors on initial launch
* Reorganized app menus
* Other bug fixes

## v0.2.0 (February 27, 2023)

* Added support for NixOS machines
* Fixed /Users/<user>/OrbStack access from within Linux machines
* Fixed Docker potentially not starting again after disabling it in the app
* Fixed potential issues with custom Docker instances in Linux machines
* Faster machine creation for some distros
* Other bug fixes

## v0.1.9 (February 25, 2023)

* Many stability improvements and bug fixes
* Added host.docker.internal and other domains for compatibility with Docker Desktop
* Added compatibility with Docker Desktop’s SSH agent forwarding
* Workaround for macOS bug: “(null) is not allowed to open documents in Terminal”
* Fixed mDNS and .local domains in distros that use systemd-resolved

## v0.1.8 (February 23, 2023)

* Added Docker buildx for extra BuildKit features
* Added support for IPv6 in Docker containers
* Added release notes
* Updated to Linux 6.1.13
* New settings UI
* Fixed compatibility issues with Earthly
* Fixed SSH access with read-only SSH configs
* Other bug fixes

## v0.1.7 (February 22, 2023)

OrbStack is now fully built with itself, including the Linux parts! 🎉

* Added support for mounting VM disk images
* Improved SSH key handling when no agent is in use
* Fixed config permissions in new machines
* Other bug fixes

## v0.1.6 (February 21, 2023)

* Improved appearance of notifications sent from Linux
* Added support for command-line tool setup without UI
* Fixed notifications on macOS 12
* Fixed handling of large ICMP packets
* Other bug fixes

© 2024 Orbital Labs, LLC

