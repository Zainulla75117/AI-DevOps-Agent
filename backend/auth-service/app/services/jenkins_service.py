import asyncio
import urllib3
import requests
import xml.etree.ElementTree as ET
from typing import Dict, Any, Optional, List
from app.models.jenkins_credentials import JenkinsCredentials

# Disable SSL warnings for self-signed certificates (common with Jenkins)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def _make_jenkins_request(url: str, username: str, token: str, endpoint: str = "", params: dict = None) -> dict:
    """
    Make a request to Jenkins API using requests library (similar to user's working code).
    
    Args:
        url: Jenkins base URL
        username: Jenkins username
        token: Jenkins API token
        endpoint: API endpoint (e.g., "/api/json")
        params: Optional query parameters
        
    Returns:
        JSON response as dictionary
    """
    full_url = f"{url.rstrip('/')}{endpoint}"
    
    response = requests.get(
        full_url,
        auth=(username, token),
        verify=False,  # Disable SSL verification for self-signed certs
        timeout=30,
        params=params or {}
    )
    response.raise_for_status()
    return response.json()

async def fetch_jenkins_data(jenkins_credentials: JenkinsCredentials) -> Dict[str, Any]:
    """
    Fetch Jenkins data using python-jenkins SDK.
    Fetches jobs, builds, nodes, and other available Jenkins information.
    
    Args:
        jenkins_credentials: JenkinsCredentials model with URL, username, and token
        
    Returns:
        Dictionary containing Jenkins data (jobs, builds, nodes, etc.)
    """
    def _fetch_sync():
        """Synchronous function to fetch Jenkins data using requests library."""
        jenkins_url = jenkins_credentials.jenkins_url.rstrip('/')
        username = jenkins_credentials.username
        token = jenkins_credentials.token
        
        print(f"🔗 Connecting to Jenkins server: {jenkins_url}")
        print(f"🔗 Username: {username}")
        
        try:
            # Test connection first (similar to user's working code)
            print(f"🔍 Testing connection to Jenkins server...")
            test_response = requests.get(
                jenkins_url,
                auth=(username, token),
                verify=False,
                timeout=30
            )
            test_response.raise_for_status()
            print(f"✅ Successfully connected to Jenkins server. Status: {test_response.status_code}")
            
            # Get Jenkins system info
            system_info = _make_jenkins_request(jenkins_url, username, token, "/whoAmI/api/json")
            
            # Get all jobs
            jobs_data = _make_jenkins_request(jenkins_url, username, token, "/api/json", {"tree": "jobs[name,url,color]"})
            jobs = jobs_data.get('jobs', [])
            
            # Get node information
            nodes_data = _make_jenkins_request(jenkins_url, username, token, "/computer/api/json")
            nodes = nodes_data.get('computer', [])
            
            # Get plugin information
            plugins_data = _make_jenkins_request(jenkins_url, username, token, "/pluginManager/api/json", {"depth": 1})
            plugins = plugins_data.get('plugins', [])
            
            # Get Jenkins credentials (credentials stored in Jenkins)
            # These are credentials managed by Jenkins Credentials plugin (SSH keys, API tokens, etc.)
            credentials_list = []
            all_credentials = []
            
            # Method 1: Fetch from system domain with depth=1 to get full details including domain
            try:
                print(f"🔍 Fetching credentials from system domain...")
                credentials_data = _make_jenkins_request(
                    jenkins_url, 
                    username, 
                    token, 
                    "/credentials/store/system/domain/_/api/json",
                    {"depth": "1"}  # Use depth instead of tree to get full details
                )
                
                system_creds = credentials_data.get('credentials', [])
                print(f"📝 Found {len(system_creds)} credentials in system domain")
                
                # Process system domain credentials
                for cred in system_creds:
                    cred_info = {
                        'id': cred.get('id', ''),
                        'description': cred.get('description', ''),
                        'displayName': cred.get('displayName', ''),
                        'typeName': cred.get('typeName', ''),
                        'fullName': cred.get('fullName', ''),
                        'domain': '_',  # System domain
                        'domainName': credentials_data.get('displayName', 'Global credentials (unrestricted)'),
                        'store': 'system',
                        'staplerClass': cred.get('stapler-class', ''),
                        'name': cred.get('displayName') or cred.get('id', ''),
                        'label': cred.get('description', ''),
                        'scope': cred.get('scope', 'GLOBAL')
                    }
                    all_credentials.append(cred_info)
                
            except Exception as e:
                print(f"⚠️ Could not fetch credentials from system domain: {e}")
                import traceback
                traceback.print_exc()
            
            # Method 2: Try to get all credential stores and domains
            try:
                print(f"🔍 Fetching all credential stores and domains...")
                stores_data = _make_jenkins_request(
                    jenkins_url,
                    username,
                    token,
                    "/credentials/api/json",
                    {"depth": "2"}  # Depth 2 to get stores, domains, and credentials
                )
                
                stores = stores_data.get('stores', [])
                print(f"📝 Found {len(stores)} credential stores")
                
                for store in stores:
                    store_name = store.get('displayName', '') or store.get('id', '')
                    store_id = store.get('id', '')
                    domains = store.get('domains', [])
                    
                    for domain in domains:
                        domain_name = domain.get('displayName', '') or domain.get('name', '_')
                        domain_id = domain.get('name', '_')
                        domain_creds = domain.get('credentials', [])
                        
                        print(f"📝 Found {len(domain_creds)} credentials in domain '{domain_name}' of store '{store_name}'")
                        
                        for cred in domain_creds:
                            # Check if we already have this credential (avoid duplicates)
                            cred_id = cred.get('id', '')
                            cred_full_name = cred.get('fullName', '')
                            
                            # Only add if not already in list
                            if not any(c.get('id') == cred_id and c.get('fullName') == cred_full_name for c in all_credentials):
                                cred_info = {
                                    'id': cred_id,
                                    'description': cred.get('description', ''),
                                    'displayName': cred.get('displayName', ''),
                                    'typeName': cred.get('typeName', ''),
                                    'fullName': cred_full_name,
                                    'domain': domain_id,
                                    'domainName': domain_name,
                                    'store': store_name,
                                    'storeId': store_id,
                                    'staplerClass': cred.get('stapler-class', ''),
                                    'name': cred.get('displayName') or cred_id,
                                    'label': cred.get('description', ''),
                                    'scope': cred.get('scope', 'GLOBAL')
                                }
                                all_credentials.append(cred_info)
                                
            except Exception as e:
                print(f"⚠️ Could not fetch credentials from stores API: {e}")
                import traceback
                traceback.print_exc()
            
            # Method 3: Try direct credentials endpoint if still no credentials found
            if len(all_credentials) == 0:
                try:
                    print(f"🔍 Trying direct credentials endpoint...")
                    direct_creds_data = _make_jenkins_request(
                        jenkins_url,
                        username,
                        token,
                        "/credentials/api/json",
                        {"tree": "credentials[id,description,displayName,typeName,fullName,domain]"}
                    )
                    
                    direct_creds = direct_creds_data.get('credentials', [])
                    print(f"📝 Found {len(direct_creds)} credentials from direct endpoint")
                    
                    for cred in direct_creds:
                        cred_info = {
                            'id': cred.get('id', ''),
                            'description': cred.get('description', ''),
                            'displayName': cred.get('displayName', ''),
                            'typeName': cred.get('typeName', ''),
                            'fullName': cred.get('fullName', ''),
                            'domain': cred.get('domain', '_'),
                            'domainName': cred.get('domain', '_'),
                            'store': 'unknown',
                            'name': cred.get('displayName') or cred.get('id', ''),
                            'label': cred.get('description', ''),
                            'scope': 'GLOBAL'
                        }
                        all_credentials.append(cred_info)
                        
                except Exception as e:
                    print(f"⚠️ Could not fetch credentials from direct endpoint: {e}")
            
            credentials_list = all_credentials
            print(f"✅ Total Jenkins credentials fetched: {len(credentials_list)}")
            
            # Get Jenkins tools - Focus on JDK, Maven, NodeJS - Just need names
            # Jenkins has two types of tool configs:
            # 1. Automatic installation (Jenkins downloads/installs) - has installers
            # 2. Manual/Pre-installed (just name + path) - user provides path
            # Both have "name" field which is what we need
            tools_list = []
            all_tool_names = set()  # Use set to avoid duplicates
            
            # Method 1: Try descriptor APIs (works for both automatic and manual tools)
            tool_descriptors = [
                ('hudson.tools.JDKInstaller', 'JDK'),
                ('hudson.tasks.Maven$MavenInstaller', 'Maven'),
                ('org.jenkinsci.plugins.nodejs.tools.NodeJSInstallation', 'NodeJS')
            ]
            
            for descriptor, tool_type in tool_descriptors:
                try:
                    descriptor_data = _make_jenkins_request(
                        jenkins_url,
                        username,
                        token,
                        f"/descriptorByName/{descriptor}/api/json",
                        {"depth": "2"}
                    )
                    
                    installations = descriptor_data.get('installations', [])
                    if installations:
                        print(f"📝 Found {len(installations)} {tool_type} installations from descriptor")
                        for inst in installations:
                            tool_name = inst.get('name', '')
                            if tool_name and tool_name not in all_tool_names:
                                all_tool_names.add(tool_name)
                                tools_list.append({
                                    'name': tool_name,
                                    'type': tool_type
                                })
                                print(f"  ✅ {tool_type}: {tool_name}")
                except Exception as e:
                    # Descriptor might not exist, continue
                    pass
            
            # Method 2: Parse config.xml - This catches both automatic and manual tools
            try:
                print(f"🔍 Parsing config.xml for tool names...")
                config_xml_response = requests.get(
                    f"{jenkins_url}/system/config.xml",
                    auth=(username, token),
                    verify=False,
                    timeout=30
                )
                
                if config_xml_response.status_code == 200:
                    root = ET.fromstring(config_xml_response.text)
                    
                    # Find all elements that have both 'name' and 'home' children
                    # This works for both automatic installers and manual/pre-installed tools
                    for elem in root.iter():
                        tool_name = elem.findtext('name', '') or elem.findtext('{*}name', '')
                        tool_home = elem.findtext('home', '') or elem.findtext('{*}home', '')
                        
                        # If it has both name and home, it's likely a tool
                        if tool_name and tool_home and tool_name not in all_tool_names:
                            # Skip system config elements
                            if 'slaveAgentPort' in tool_name or 'numExecutors' in tool_name:
                                continue
                            
                            # Determine type from element tag or parent
                            elem_tag = elem.tag.lower()
                            parent_tag = ''
                            for parent in root.iter():
                                if elem in list(parent):
                                    parent_tag = parent.tag.lower()
                                    break
                            
                            tool_type = 'Unknown'
                            # Check for JDK/Java
                            if any(x in elem_tag or x in parent_tag for x in ['jdk', 'java']):
                                tool_type = 'JDK'
                            # Check for Maven
                            elif 'maven' in elem_tag or 'maven' in parent_tag:
                                tool_type = 'Maven'
                            # Check for NodeJS
                            elif any(x in elem_tag or x in parent_tag for x in ['node', 'nodejs']):
                                tool_type = 'NodeJS'
                            
                            # Only add JDK, Maven, NodeJS
                            if tool_type in ['JDK', 'Maven', 'NodeJS']:
                                all_tool_names.add(tool_name)
                                tools_list.append({
                                    'name': tool_name,
                                    'type': tool_type
                                })
                                print(f"  ✅ {tool_type} from XML: {tool_name}")
            except Exception as e:
                print(f"⚠️ Could not parse config.xml: {e}")
            
            print(f"✅ Total tools found: {len(tools_list)} (JDK, Maven, NodeJS)")
            
            # Fetch detailed information for each job
            jobs_detail = []
            for job in jobs:
                try:
                    job_name = job.get('name', '')
                    if not job_name:
                        continue
                    
                    # Get detailed job info
                    job_info = _make_jenkins_request(
                        jenkins_url, 
                        username, 
                        token, 
                        f"/job/{job_name}/api/json",
                        {"tree": "name,url,description,color,healthReport,lastBuild,lastCompletedBuild,lastFailedBuild,lastSuccessfulBuild,lastUnstableBuild,lastUnsuccessfulBuild,nextBuildNumber,buildable,concurrentBuild,inQueue,keepDependencies,property,upstreamProjects,downstreamProjects,scm,actions"}
                    )
                    
                    jobs_detail.append({
                        'name': job_info.get('name', job_name),
                        'url': job_info.get('url', job.get('url', '')),
                        'description': job_info.get('description', ''),
                        'color': job_info.get('color', job.get('color', '')),
                        'healthReport': job_info.get('healthReport', []),
                        'lastBuild': job_info.get('lastBuild', {}),
                        'lastCompletedBuild': job_info.get('lastCompletedBuild', {}),
                        'lastFailedBuild': job_info.get('lastFailedBuild', {}),
                        'lastSuccessfulBuild': job_info.get('lastSuccessfulBuild', {}),
                        'lastUnstableBuild': job_info.get('lastUnstableBuild', {}),
                        'lastUnsuccessfulBuild': job_info.get('lastUnsuccessfulBuild', {}),
                        'nextBuildNumber': job_info.get('nextBuildNumber', 0),
                        'buildable': job_info.get('buildable', False),
                        'concurrentBuild': job_info.get('concurrentBuild', False),
                        'inQueue': job_info.get('inQueue', False),
                        'keepDependencies': job_info.get('keepDependencies', False),
                        'property': job_info.get('property', []),
                        'upstreamProjects': job_info.get('upstreamProjects', []),
                        'downstreamProjects': job_info.get('downstreamProjects', []),
                        'scm': job_info.get('scm', {}),
                        'actions': job_info.get('actions', [])
                    })
                except Exception as e:
                    print(f"⚠️ Error fetching details for job {job.get('name', 'unknown')}: {e}")
                    # Include basic job info even if detailed fetch fails
                    jobs_detail.append({
                        'name': job.get('name', ''),
                        'url': job.get('url', ''),
                        'color': job.get('color', ''),
                        'error': str(e)
                    })
            
            # Get Jenkins version (from system info or separate endpoint)
            try:
                version_data = _make_jenkins_request(jenkins_url, username, token, "/api/json", {"tree": "jenkinsVersion"})
                version_info = version_data.get('jenkinsVersion', 'Unknown')
            except:
                version_info = 'Unknown'
            
            # Compile all Jenkins data
            jenkins_data = {
                'version': version_info,
                'system_info': system_info,
                'jobs': jobs_detail,
                'jobs_count': len(jobs_detail),
                'nodes': nodes,
                'nodes_count': len(nodes),
                'plugins': plugins,
                'plugins_count': len(plugins) if isinstance(plugins, list) else 0,
                'credentials': credentials_list,
                'credentials_count': len(credentials_list),
                'tools': tools_list,
                'tools_count': len(tools_list),
                'jenkins_url': jenkins_credentials.jenkins_url,
                'username': jenkins_credentials.username,
                'type': jenkins_credentials.type
            }
            
            print(f"✅ Successfully fetched Jenkins data: {len(jobs_detail)} jobs, {len(nodes)} nodes, {len(plugins)} plugins, {len(credentials_list)} credentials, {len(tools_list)} tools")
            return jenkins_data
            
        except requests.exceptions.HTTPError as e:
            error_msg = str(e)
            status_code = e.response.status_code if hasattr(e, 'response') else None
            print(f"❌ Jenkins HTTP error: {error_msg}")
            print(f"❌ Status code: {status_code}")
            print(f"❌ Jenkins URL: {jenkins_url}")
            print(f"❌ Username: {username}")
            
            if status_code == 401:
                raise Exception(
                    f"Jenkins authentication failed. Please check your username and token. "
                    f"URL: {jenkins_url}, Username: {username}"
                )
            elif status_code == 404:
                raise Exception(
                    f"Jenkins server not found or endpoint not available. "
                    f"Please verify the Jenkins URL: {jenkins_url}"
                )
            else:
                raise Exception(
                    f"Jenkins HTTP error (Status {status_code}): {error_msg}. "
                    f"URL: {jenkins_url}, Username: {username}"
                )
        except requests.exceptions.RequestException as e:
            error_msg = str(e)
            print(f"❌ Error connecting to Jenkins server: {error_msg}")
            print(f"❌ Jenkins URL: {jenkins_url}")
            print(f"❌ Username: {username}")
            import traceback
            traceback.print_exc()
            
            if "Connection" in error_msg or "connect" in error_msg.lower():
                raise Exception(
                    f"Cannot connect to Jenkins server. Please verify: "
                    f"1. The Jenkins URL is correct: {jenkins_url} "
                    f"2. The Jenkins server is accessible from this network "
                    f"3. Firewall/network settings allow the connection. "
                    f"Original error: {error_msg}"
                )
            elif "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
                raise Exception(
                    f"Connection timeout. The Jenkins server may be unreachable or slow. "
                    f"URL: {jenkins_url}. "
                    f"Original error: {error_msg}"
                )
            else:
                raise Exception(
                    f"Failed to connect to Jenkins server: {error_msg}. "
                    f"URL: {jenkins_url}"
                )
        except Exception as e:
            error_msg = str(e)
            print(f"❌ Error fetching Jenkins data: {error_msg}")
            print(f"❌ Jenkins URL: {jenkins_url}")
            print(f"❌ Username: {username}")
            import traceback
            traceback.print_exc()
            raise Exception(
                f"Failed to fetch Jenkins data: {error_msg}. "
                f"URL: {jenkins_url}"
            )
    
    # Run synchronous Jenkins SDK calls in thread pool
    return await asyncio.to_thread(_fetch_sync)

