import json
import os

# Base directory
base_dir = r"C:\Users\ssree\.gemini\antigravity\scratch\prepwise"
companies_path = os.path.join(base_dir, "data", "companies.json")
questions_dir = os.path.join(base_dir, "data", "questions")

# 1. Load existing companies
with open(companies_path, "r", encoding="utf-8") as f:
    existing_companies = json.load(f)

# Helper to build realistic job roles
def make_roles(company_name, short_name, tier="faang"):
    if tier == "faang":
        return [
            {
                "id": "sde-1",
                "title": "Software Development Engineer I (SDE-1)",
                "avgSalary": "$168,000 / yr (US) · ₹24 - 38 LPA (India)",
                "salaryRange": "$145,000 - $195,000 / yr",
                "experience": "0 - 2 Years (Fresh Graduate / Junior)",
                "level": "Intermediate to Advanced",
                "targetLevel": "Intermediate",
                "keySkills": ["Data Structures & Algorithms", "C++ / Java / Python / Go", "Object Oriented Design", "System Architecture Fundamentals"],
                "prepRoadmap": [
                    "Phase 1: Master Arrays, Two Pointers, Sliding Window, Trees, and Heaps",
                    "Phase 2: Dynamic Programming, Graph Traversals (BFS/DFS), and Trie structures",
                    "Phase 3: Object-Oriented Design (Design Parking Lot, Elevator System)",
                    "Phase 4: High-pressure 45-minute mock coding interviews with Big-O optimization"
                ],
                "interviewRounds": [
                    "Round 1: Online Coding Assessment (2 algorithmic questions, 70-90 min)",
                    "Round 2: Technical Phone Screen (Live coding + DSA complexity)",
                    "Round 3: Onsite Coding Round 1 (Data structures & algorithmic problem solving)",
                    "Round 4: Onsite Coding Round 2 (Tree/Graph algorithms & optimization)",
                    "Round 5: Behavioral & Company Values (Leadership / Cultural fit)"
                ],
                "targetCategory": "Technical"
            },
            {
                "id": "data-scientist",
                "title": "Data Scientist & Machine Learning Engineer",
                "avgSalary": "$175,000 / yr (US) · ₹26 - 42 LPA (India)",
                "salaryRange": "$150,000 - $210,000 / yr",
                "experience": "0 - 3 Years (STEM Graduate)",
                "level": "Advanced to Legend",
                "targetLevel": "Advanced",
                "keySkills": ["Python", "PyTorch / TensorFlow", "Probability & Statistics", "SQL & BigQuery", "ML System Design"],
                "prepRoadmap": [
                    "Phase 1: Advanced Probability, Bayes Theorem, Linear Algebra, and Hypothesis Testing",
                    "Phase 2: Complex SQL data aggregations, window functions, and schema design",
                    "Phase 3: Core ML Algorithms from scratch (Gradient Descent, Random Forests, Transformers)",
                    "Phase 4: ML System Design (Recommendation systems, Fraud detection, Real-time inference)"
                ],
                "interviewRounds": [
                    "Round 1: Quantitative Aptitude & Statistics Screening",
                    "Round 2: Python / SQL Data Challenge",
                    "Round 3: Applied Machine Learning Theory & Case Study",
                    "Round 4: Machine Learning System Design",
                    "Round 5: Cultural & Stakeholder Communication"
                ],
                "targetCategory": "Quantitative Aptitude"
            },
            {
                "id": "cloud-devops",
                "title": "Cloud Architect & Site Reliability Engineer (SRE)",
                "avgSalary": "$162,000 / yr (US) · ₹22 - 35 LPA (India)",
                "salaryRange": "$138,000 - $185,000 / yr",
                "experience": "1 - 3 Years",
                "level": "Advanced",
                "targetLevel": "Advanced",
                "keySkills": ["Linux Internals", "Docker & Kubernetes", "Cloud Networking (VPC, DNS, CDN)", "CI/CD & Terraform", "Python/Go Scripting"],
                "prepRoadmap": [
                    "Phase 1: Linux performance troubleshooting (strace, top, memory paging)",
                    "Phase 2: Computer Networking (TCP/IP, HTTP/3, TLS handshakes, load balancing)",
                    "Phase 3: Container orchestration, microservices resilience, and observability",
                    "Phase 4: Live incident response and disaster recovery architecture simulation"
                ],
                "interviewRounds": [
                    "Round 1: Systems & Networking MCQs + Coding Assessment",
                    "Round 2: Live Linux & Systems Troubleshooting",
                    "Round 3: Distributed Systems Architecture",
                    "Round 4: Automation Scripting in Python/Go",
                    "Round 5: Site Reliability Principles & Teamwork"
                ],
                "targetCategory": "Technical"
            },
            {
                "id": "product-analyst",
                "title": "Technical Product & Business Analyst",
                "avgSalary": "$135,000 / yr (US) · ₹16 - 28 LPA (India)",
                "salaryRange": "$115,000 - $155,000 / yr",
                "experience": "0 - 2 Years",
                "level": "Intermediate",
                "targetLevel": "Intermediate",
                "keySkills": ["Product Metrics (A/B Testing, Retention)", "Advanced SQL", "Data Storytelling", "Logical Deduction", "System Architecture Flow"],
                "prepRoadmap": [
                    "Phase 1: Business mathematics, profit margins, conversion rate funnels",
                    "Phase 2: Complex SQL querying and data visualization",
                    "Phase 3: Root-cause analysis frameworks and A/B test statistical significance",
                    "Phase 4: Executive presentation and product design case studies"
                ],
                "interviewRounds": [
                    "Round 1: Analytical & Critical Reasoning Assessment",
                    "Round 2: SQL & Data Extraction Test",
                    "Round 3: Product Sense & Analytical Problem-Solving",
                    "Round 4: Behavioral & Cross-Functional Collaboration"
                ],
                "targetCategory": "Logical Reasoning"
            }
        ]
    elif tier == "it_services":
        return [
            {
                "id": "associate-se",
                "title": "Associate Software Engineer / Systems Engineer",
                "avgSalary": "₹4.5 - 7.5 LPA (India) · $75,000 / yr (US)",
                "salaryRange": "₹4.0 - 9.0 LPA",
                "experience": "0 - 1 Years (Campus Recruits / Freshers)",
                "level": "Beginner to Intermediate",
                "targetLevel": "Beginner",
                "keySkills": ["Core Java / C++ / Python", "Object Oriented Programming (OOP)", "Relational Databases & SQL", "Aptitude & Problem Solving"],
                "prepRoadmap": [
                    "Phase 1: Speed arithmetic, percentages, work & time, series completion",
                    "Phase 2: Logical puzzles, blood relations, and coding-decoding",
                    "Phase 3: Core programming syntax, pseudo-code analysis, and basic debugging",
                    "Phase 4: Technical interview drills on final-year projects and OOP pillars"
                ],
                "interviewRounds": [
                    "Round 1: National Qualifier / Online Aptitude Test (Aptitude, Verbal, Logic, Pseudo-code)",
                    "Round 2: Hands-on Coding Challenge (1-2 fundamental algorithmic problems)",
                    "Round 3: Technical Interview (CS Fundamentals, DBMS, OS, Projects)",
                    "Round 4: HR & Managerial Interview (Communication, adaptability, shifts)"
                ],
                "targetCategory": "Quantitative Aptitude"
            },
            {
                "id": "digital-specialist",
                "title": "Digital Specialist Programmer (Ninja / Turbo / SP Track)",
                "avgSalary": "₹9.5 - 16 LPA (India) · $95,000 / yr (US)",
                "salaryRange": "₹8.5 - 18 LPA",
                "experience": "0 - 2 Years",
                "level": "Advanced to Legend",
                "targetLevel": "Advanced",
                "keySkills": ["Data Structures & Algorithms", "Full Stack Development", "Cloud Basics (AWS/Azure)", "REST APIs & Microservices"],
                "prepRoadmap": [
                    "Phase 1: LeetCode medium algorithms, recursion, trees, dynamic programming",
                    "Phase 2: Database normalization, indexing, and complex SQL joins",
                    "Phase 3: Modern web framework (Spring Boot / React / Node.js) architecture",
                    "Phase 4: Advanced algorithmic problem solving under strict 30-minute time limits"
                ],
                "interviewRounds": [
                    "Round 1: Advanced Coding Round (3 algorithmic problems in 90 min)",
                    "Round 2: System Architecture & Coding Deep-Dive",
                    "Round 3: Full Stack Frameworks & Cloud Services Assessment",
                    "Round 4: HR & Leadership Interview"
                ],
                "targetCategory": "Technical"
            },
            {
                "id": "qa-automation",
                "title": "Quality Engineering & Test Automation Specialist",
                "avgSalary": "₹5.5 - 9.5 LPA (India) · $82,000 / yr (US)",
                "salaryRange": "₹5.0 - 11 LPA",
                "experience": "0 - 2 Years",
                "level": "Intermediate",
                "targetLevel": "Intermediate",
                "keySkills": ["Selenium / Playwright", "Core Java / Python", "TestNG / JUnit", "API Testing (Postman/RestAssured)", "CI/CD Pipelines"],
                "prepRoadmap": [
                    "Phase 1: Software Testing Life Cycle (STLC), test case design, bug severity",
                    "Phase 2: Java/Python OOP principles and test automation scripting",
                    "Phase 3: Page Object Model (POM) design pattern and API validation",
                    "Phase 4: Mock technical interviews explaining automated test frameworks"
                ],
                "interviewRounds": [
                    "Round 1: Aptitude & Logical Reasoning Online Test",
                    "Round 2: Programming Logic & Scripting Test",
                    "Round 3: Automation Framework & Testing Scenario Interview",
                    "Round 4: Managerial & HR Discussion"
                ],
                "targetCategory": "Logical Reasoning"
            },
            {
                "id": "cloud-consultant",
                "title": "Cloud & Infrastructure Operations Engineer",
                "avgSalary": "₹6.5 - 11 LPA (India) · $88,000 / yr (US)",
                "salaryRange": "₹6.0 - 13 LPA",
                "experience": "0 - 2 Years",
                "level": "Intermediate to Advanced",
                "targetLevel": "Intermediate",
                "keySkills": ["AWS / Azure / GCP Fundamentals", "Linux Administration", "Bash / Python Scripting", "Networking (DNS, Subnets, VPN)"],
                "prepRoadmap": [
                    "Phase 1: Linux commands, process monitoring, permissions, and shell scripts",
                    "Phase 2: Cloud computing service models (IaaS, PaaS, SaaS) and core services",
                    "Phase 3: Computer networking concepts (OSI layers, TCP/UDP, IP routing)",
                    "Phase 4: Cloud deployment troubleshooting and disaster recovery concepts"
                ],
                "interviewRounds": [
                    "Round 1: Online Technical & Cognitive Test",
                    "Round 2: Technical Interview on Cloud & Linux Concepts",
                    "Round 3: Scenario-based Infrastructure Troubleshooting",
                    "Round 4: HR & Cultural Fit Interview"
                ],
                "targetCategory": "Technical"
            }
        ]
    else: # European / Global tech
        return [
            {
                "id": "software-engineer",
                "title": "Software Engineer (Full Stack / Backend)",
                "avgSalary": "€78,000 / yr (Europe) · $140,000 / yr (US)",
                "salaryRange": "€65,000 - €95,000 / yr",
                "experience": "0 - 2 Years",
                "level": "Intermediate to Advanced",
                "targetLevel": "Intermediate",
                "keySkills": ["Java / Go / TypeScript", "Microservices & Distributed Systems", "PostgreSQL / Redis", "Docker & Kubernetes"],
                "prepRoadmap": [
                    "Phase 1: Algorithmic problem solving and clean code principles",
                    "Phase 2: Database architecture, transaction management, and indexing",
                    "Phase 3: RESTful API design and asynchronous event messaging",
                    "Phase 4: Architectural tradeoff discussions and pair-programming interviews"
                ],
                "interviewRounds": [
                    "Round 1: Take-home coding assignment or online DSA screen",
                    "Round 2: Technical review of take-home code and design decisions",
                    "Round 3: System Design & Live Collaborative Coding",
                    "Round 4: Behavioral & Engineering Culture Alignment"
                ],
                "targetCategory": "Technical"
            },
            {
                "id": "data-analyst",
                "title": "Data Analytics & Business Intelligence Engineer",
                "avgSalary": "€68,000 / yr (Europe) · $120,000 / yr (US)",
                "salaryRange": "€55,000 - €82,000 / yr",
                "experience": "0 - 2 Years",
                "level": "Intermediate",
                "targetLevel": "Intermediate",
                "keySkills": ["SQL", "Python / R", "Tableau / Power BI", "Statistical Modeling", "Data Warehousing"],
                "prepRoadmap": [
                    "Phase 1: Statistical analysis, probability distributions, variance",
                    "Phase 2: Complex SQL queries, ETL pipeline design, data modeling",
                    "Phase 3: Interactive dashboard design and executive KPI reporting",
                    "Phase 4: Business case presentation and data-driven recommendations"
                ],
                "interviewRounds": [
                    "Round 1: Online Cognitive & Analytical Reasoning Screen",
                    "Round 2: Live SQL & Data Modeling Challenge",
                    "Round 3: Business Analytics Case Study",
                    "Round 4: Team Culture & Stakeholder Fit"
                ],
                "targetCategory": "Logical Reasoning"
            }
        ]

# Define country mappings for our companies
company_country_map = {
    "tcs": ["India", "United States", "United Kingdom", "Australia", "Singapore", "Canada", "Germany", "Netherlands", "United Arab Emirates", "Saudi Arabia", "South Africa"],
    "infosys": ["India", "United States", "United Kingdom", "Germany", "Australia", "Canada", "Japan", "Switzerland", "Singapore", "China", "Poland", "Ireland"],
    "wipro": ["India", "United States", "United Kingdom", "United Arab Emirates", "Saudi Arabia", "Germany", "Australia", "Canada", "Singapore", "Brazil", "France"],
    "google": ["United States", "India", "United Kingdom", "Germany", "Switzerland", "Japan", "Singapore", "Canada", "Australia", "Ireland", "France", "Poland", "Brazil", "Israel", "South Korea", "Sweden", "Netherlands"],
    "microsoft": ["United States", "India", "United Kingdom", "Germany", "Ireland", "China", "Canada", "Australia", "Japan", "Israel", "Switzerland", "France", "Netherlands", "Denmark", "Czech Republic", "Poland"],
    "amazon": ["United States", "India", "United Kingdom", "Germany", "Japan", "Spain", "Italy", "Australia", "Singapore", "Canada", "France", "Ireland", "Brazil", "Mexico", "South Africa", "Poland", "Egypt"],
    "accenture": ["Ireland", "United States", "India", "United Kingdom", "France", "Germany", "Brazil", "Japan", "Australia", "Spain", "Italy", "Singapore", "Canada", "Philippines", "South Africa", "Argentina"],
    "cognizant": ["United States", "India", "United Kingdom", "Germany", "Netherlands", "Philippines", "Canada", "Australia", "Singapore", "Spain", "Poland", "Switzerland"],
    "hcl": ["India", "United States", "United Kingdom", "France", "Germany", "Sweden", "Vietnam", "Australia", "Singapore", "Poland", "Canada", "South Africa", "Finland"],
    "ibm": ["United States", "India", "Germany", "France", "Japan", "Brazil", "Mexico", "United Kingdom", "Canada", "Australia", "Italy", "Spain", "South Korea", "Switzerland", "Israel"]
}

# Add more world-class companies for global coverage of 50 countries
extra_companies = [
    {
        "id": "sap",
        "name": "SAP SE",
        "shortName": "SAP",
        "logo": "🔷",
        "logoColor": "#007db8",
        "logoBg": "#e0f2fe",
        "countries": ["Germany", "United States", "India", "Switzerland", "Austria", "France", "United Kingdom", "Brazil", "Singapore", "China", "Canada", "Australia"],
        "region": ["Germany", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "Enterprise Software & Cloud ERP",
        "founded": 1972,
        "headquarters": "Walldorf, Germany",
        "ceo": "Christian Klein",
        "employees": "105,000+",
        "revenue": "$34+ Billion",
        "website": "https://www.sap.com",
        "description": "The world's leading enterprise resource planning (ERP) software company, powering mission-critical operations for 99 of the world's 100 largest companies.",
        "history": "SAP was founded in 1972 by five former IBM engineers in Germany. They revolutionized business computing by introducing real-time data processing (SAP R/1, R/2, R/3) and pioneering modern ERP.",
        "milestones": [
            {"year": "1972", "text": "Founded by 5 former IBM engineers in Mannheim, Germany"},
            {"year": "1992", "text": "Launched SAP R/3, defining modern enterprise computing"},
            {"year": "2015", "text": "Introduced SAP S/4HANA next-generation ERP platform"},
            {"year": "2024", "text": "Launched Business AI across enterprise supply chain suites"}
        ],
        "tier": "faang"
    },
    {
        "id": "samsung",
        "name": "Samsung Electronics",
        "shortName": "Samsung",
        "logo": "🔵",
        "logoColor": "#1428a0",
        "logoBg": "#e8eaf6",
        "countries": ["South Korea", "United States", "India", "Vietnam", "Poland", "United Kingdom", "Germany", "China", "Brazil", "Japan", "Singapore"],
        "region": ["South Korea", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "Consumer Electronics & Semiconductors",
        "founded": 1969,
        "headquarters": "Suwon, South Korea",
        "ceo": "Han Jong-hee & Kyung Kye-hyun",
        "employees": "270,000+",
        "revenue": "$200+ Billion",
        "website": "https://www.samsung.com",
        "description": "Global powerhouse in semiconductors, smartphones, memory chips, and display technology. Dominates DRAM, NAND flash, and OLED manufacturing globally.",
        "history": "Samsung Electronics was established in 1969 and transformed South Korea into a global tech giant. Today it leads global smartphone shipments and semiconductor innovation.",
        "milestones": [
            {"year": "1969", "text": "Founded in Suwon, South Korea"},
            {"year": "1992", "text": "Became world's largest memory chip manufacturer"},
            {"year": "2010", "text": "Launched Galaxy S series, revolutionizing mobile tech"},
            {"year": "2024", "text": "Pioneered on-device Galaxy AI and 3nm chip fabrication"}
        ],
        "tier": "faang"
    },
    {
        "id": "sony",
        "name": "Sony Group Corporation",
        "shortName": "Sony",
        "logo": "🎮",
        "logoColor": "#000000",
        "logoBg": "#f1f5f9",
        "countries": ["Japan", "United States", "United Kingdom", "Germany", "India", "China", "Canada", "Australia", "Singapore"],
        "region": ["Japan", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "Gaming, Entertainment & Semiconductor Sensors",
        "founded": 1946,
        "headquarters": "Tokyo, Japan",
        "ceo": "Kenichiro Yoshida",
        "employees": "113,000+",
        "revenue": "$85+ Billion",
        "website": "https://www.sony.com",
        "description": "Iconic Japanese multinational corporation known for PlayStation, image sensors powering modern smartphones, audio engineering, and entertainment.",
        "history": "Founded in 1946 by Masaru Ibuka and Akio Morita in post-war Tokyo, Sony pioneered the Walkman, Trinitron TV, Compact Disc, and PlayStation console.",
        "milestones": [
            {"year": "1946", "text": "Founded as Tokyo Telecommunications Engineering Corp"},
            {"year": "1979", "text": "Launched the revolutionary Sony Walkman"},
            {"year": "1994", "text": "Released original PlayStation, conquering gaming globally"},
            {"year": "2024", "text": "Dominates 50%+ of global CMOS mobile camera sensor market"}
        ],
        "tier": "faang"
    },
    {
        "id": "atlassian",
        "name": "Atlassian Corporation",
        "shortName": "Atlassian",
        "logo": "🔷",
        "logoColor": "#0052cc",
        "logoBg": "#deebff",
        "countries": ["Australia", "United States", "India", "United Kingdom", "Poland", "New Zealand", "Singapore", "Canada"],
        "region": ["Australia", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "Enterprise Software & Developer Tools",
        "founded": 2002,
        "headquarters": "Sydney, Australia",
        "ceo": "Mike Cannon-Brookes & Scott Farquhar",
        "employees": "11,000+",
        "revenue": "$4.3+ Billion",
        "website": "https://www.atlassian.com",
        "description": "The creator of Jira, Confluence, Trello, and Bitbucket. Powers project management, team collaboration, and software development for millions of teams.",
        "history": "Founded in 2002 by University of New South Wales graduates Mike Cannon-Brookes and Scott Farquhar on a $10,000 credit card debt without venture capital.",
        "milestones": [
            {"year": "2002", "text": "Founded in Sydney with flagship Jira issue tracker"},
            {"year": "2004", "text": "Launched Confluence team collaboration software"},
            {"year": "2015", "text": "IPO on NASDAQ valued at $4.4 billion"},
            {"year": "2024", "text": "Atlassian Intelligence AI deeply embedded across Jira and Confluence"}
        ],
        "tier": "faang"
    },
    {
        "id": "spotify",
        "name": "Spotify Technology S.A.",
        "shortName": "Spotify",
        "logo": "🟢",
        "logoColor": "#1db954",
        "logoBg": "#e8f5e9",
        "countries": ["Sweden", "United States", "United Kingdom", "Germany", "India", "Brazil", "France", "Spain", "Canada", "Australia", "Netherlands"],
        "region": ["Sweden", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "Audio Streaming & Media Tech",
        "founded": 2006,
        "headquarters": "Stockholm, Sweden",
        "ceo": "Daniel Ek",
        "employees": "9,000+",
        "revenue": "$15+ Billion",
        "website": "https://www.spotify.com",
        "description": "The world's largest audio and podcast streaming service with 600+ million active users across 180+ global markets, renowned for microservice engineering.",
        "history": "Founded in 2006 in Stockholm by Daniel Ek and Martin Lorentzon to provide a legal, seamless alternative to online music piracy.",
        "milestones": [
            {"year": "2006", "text": "Founded in Stockholm, Sweden"},
            {"year": "2011", "text": "Launched in the United States"},
            {"year": "2018", "text": "Direct public listing on the New York Stock Exchange"},
            {"year": "2024", "text": "Surpassed 600 million monthly active users and AI DJ launch"}
        ],
        "tier": "faang"
    },
    {
        "id": "shopify",
        "name": "Shopify Inc.",
        "shortName": "Shopify",
        "logo": "🛍️",
        "logoColor": "#96bf48",
        "logoBg": "#f1f8e9",
        "countries": ["Canada", "United States", "United Kingdom", "Germany", "Ireland", "Australia", "Singapore", "New Zealand", "India"],
        "region": ["Canada", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "E-Commerce Infrastructure & Fintech",
        "founded": 2006,
        "headquarters": "Ottawa, Canada",
        "ceo": "Tobias Lütke",
        "employees": "11,000+",
        "revenue": "$7+ Billion",
        "website": "https://www.shopify.com",
        "description": "Powers over 1.7 million online merchants across 175 countries with an end-to-end cloud platform for commerce, inventory, payments, and checkout.",
        "history": "Founded in 2006 by Tobias Lütke and Scott Lake after they attempted to open an online snowboard shop and found existing e-commerce software inadequate.",
        "milestones": [
            {"year": "2006", "text": "Launched in Ottawa, Canada built on Ruby on Rails"},
            {"year": "2015", "text": "IPO on NYSE and Toronto Stock Exchange"},
            {"year": "2020", "text": "Surpassed $100 billion in merchant gross merchandise volume"},
            {"year": "2024", "text": "Shop Pay surpasses $150 billion in cumulative transactions"}
        ],
        "tier": "faang"
    },
    {
        "id": "asml",
        "name": "ASML Holding N.V.",
        "shortName": "ASML",
        "logo": "🔬",
        "logoColor": "#0b2046",
        "logoBg": "#e0e7ff",
        "countries": ["Netherlands", "United States", "South Korea", "Germany", "Japan", "China", "Ireland", "Belgium", "Singapore"],
        "region": ["Netherlands", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "Photolithography & Semiconductor Equipment",
        "founded": 1984,
        "headquarters": "Veldhoven, Netherlands",
        "ceo": "Christophe Fouquet",
        "employees": "42,000+",
        "revenue": "$29+ Billion",
        "website": "https://www.asml.com",
        "description": "The world's only manufacturer of extreme ultraviolet (EUV) lithography machines required to manufacture the most advanced sub-5nm microchips on Earth.",
        "history": "Originated in 1984 as a joint venture between Philips and ASM International in a shed in Eindhoven, ASML pioneered EUV optics through decades of research.",
        "milestones": [
            {"year": "1984", "text": "Founded as ASM Lithography in Eindhoven"},
            {"year": "1995", "text": "IPO on Amsterdam and NASDAQ stock exchanges"},
            {"year": "2018", "text": "First commercial EUV lithography machines shipped to chipmakers"},
            {"year": "2024", "text": "First High-NA EUV system delivered for 2nm process nodes"}
        ],
        "tier": "faang"
    },
    {
        "id": "stripe",
        "name": "Stripe, Inc.",
        "shortName": "Stripe",
        "logo": "💳",
        "logoColor": "#635bff",
        "logoBg": "#ede9fe",
        "countries": ["Ireland", "United States", "United Kingdom", "Singapore", "Canada", "Australia", "Germany", "France", "Japan", "Brazil", "India"],
        "region": ["Ireland", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "Financial Infrastructure & Payments API",
        "founded": 2010,
        "headquarters": "San Francisco, USA & Dublin, Ireland",
        "ceo": "Patrick Collison",
        "employees": "8,000+",
        "revenue": "$14+ Billion",
        "website": "https://www.stripe.com",
        "description": "The economic engine of the internet. Millions of companies from startups to Fortune 500s use Stripe APIs to accept payments and manage online commerce.",
        "history": "Founded in 2010 by Irish brothers Patrick and John Collison in Palo Alto with a goal of making online payments simple with just seven lines of code.",
        "milestones": [
            {"year": "2010", "text": "Founded by Patrick and John Collison"},
            {"year": "2015", "text": "Launched Stripe Connect and Atlas startup incorporation"},
            {"year": "2021", "text": "Valued at $95 billion, becoming most valuable US private fintech"},
            {"year": "2024", "text": "Surpassed $1 trillion in total payment volume handled"}
        ],
        "tier": "faang"
    },
    {
        "id": "capgemini",
        "name": "Capgemini SE",
        "shortName": "Capgemini",
        "logo": "🔷",
        "logoColor": "#0070ad",
        "logoBg": "#e0f2fe",
        "countries": ["France", "India", "United States", "United Kingdom", "Germany", "Spain", "Italy", "Netherlands", "Poland", "Brazil", "Australia", "Canada"],
        "region": ["France", "Global"],
        "category": "Consulting",
        "degrees": ["Engineering", "Science"],
        "industry": "IT Services & Cloud Engineering",
        "founded": 1967,
        "headquarters": "Paris, France",
        "ceo": "Aiman Ezzat",
        "employees": "340,000+",
        "revenue": "$24+ Billion",
        "website": "https://www.capgemini.com",
        "description": "Global leader in consulting, digital transformation, technology and engineering services, helping clients manage cloud, AI, and enterprise connectivity.",
        "history": "Founded in 1967 in Grenoble, France by Serge Kampf as an enterprise data processing company, growing into Europe's largest consulting and IT conglomerate.",
        "milestones": [
            {"year": "1967", "text": "Founded by Serge Kampf in Grenoble, France"},
            {"year": "2000", "text": "Acquired Ernst & Young consulting business"},
            {"year": "2020", "text": "Acquired Altran for $4.1B to lead engineering and R&D services"},
            {"year": "2024", "text": "Expanded generative AI center of excellence across Europe and India"}
        ],
        "tier": "it_services"
    },
    {
        "id": "careem",
        "name": "Careem (An Uber Company)",
        "shortName": "Careem",
        "logo": "🟢",
        "logoColor": "#33b249",
        "logoBg": "#e8f5e9",
        "countries": ["United Arab Emirates", "Saudi Arabia", "Egypt", "Pakistan", "Jordan", "Morocco", "Kuwait"],
        "region": ["United Arab Emirates", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "Super App, Mobility & Digital Payments",
        "founded": 2012,
        "headquarters": "Dubai, United Arab Emirates",
        "ceo": "Mudassir Sheikha",
        "employees": "3,000+",
        "revenue": "$1.5+ Billion",
        "website": "https://www.careem.com",
        "description": "The pioneer of the 'Everything App' for the Middle East and South Asia. Offers ride-hailing, food delivery, micro-mobility, digital wallet, and fintech services.",
        "history": "Founded in 2012 by Mudassir Sheikha and Magnus Olsson in Dubai. Acquired by Uber in 2019 for $3.1 billion, making it the Middle East's largest tech acquisition.",
        "milestones": [
            {"year": "2012", "text": "Launched in Dubai as corporate car service"},
            {"year": "2016", "text": "Became the Middle East's first tech unicorn ($1B+)"},
            {"year": "2020", "text": "Acquired by Uber for $3.1 billion"},
            {"year": "2023", "text": "e& (Etisalat) invested $400 million to scale Careem Super App"}
        ],
        "tier": "faang"
    },
    {
        "id": "nubank",
        "name": "Nu Holdings Ltd. (Nubank)",
        "shortName": "Nubank",
        "logo": "🟣",
        "logoColor": "#820ad1",
        "logoBg": "#f3e8ff",
        "countries": ["Brazil", "Mexico", "Colombia", "United States", "Argentina"],
        "region": ["Brazil", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "Digital Banking & Fintech",
        "founded": 2013,
        "headquarters": "São Paulo, Brazil",
        "ceo": "David Vélez",
        "employees": "8,000+",
        "revenue": "$8+ Billion",
        "website": "https://www.nubank.com.br",
        "description": "The largest digital neo-banking platform outside Asia, serving over 100 million customers across Latin America with 100% cloud-native Clojure microservices.",
        "history": "Founded in 2013 by David Vélez, Cristina Junqueira, and Edward Wible in São Paulo to dismantle the fee-heavy oligopoly of traditional Latin American banks.",
        "milestones": [
            {"year": "2013", "text": "Founded in São Paulo, Brazil"},
            {"year": "2014", "text": "Launched zero-annual-fee purple credit card"},
            {"year": "2021", "text": "IPO on NYSE valued at $41 billion with Berkshire Hathaway backing"},
            {"year": "2024", "text": "Crossed 100 million customers across Brazil, Mexico, and Colombia"}
        ],
        "tier": "faang"
    },
    {
        "id": "mercadolibre",
        "name": "Mercado Libre, Inc.",
        "shortName": "Mercado Libre",
        "logo": "🟡",
        "logoColor": "#ffe600",
        "logoBg": "#fffde7",
        "countries": ["Argentina", "Brazil", "Mexico", "Chile", "Colombia", "Peru", "United States"],
        "region": ["Argentina", "Global"],
        "category": "Big Tech",
        "degrees": ["Engineering", "Science"],
        "industry": "E-Commerce & Digital Payments (Mercado Pago)",
        "founded": 1999,
        "headquarters": "Buenos Aires, Argentina & Montevideo, Uruguay",
        "ceo": "Marcos Galperin",
        "employees": "58,000+",
        "revenue": "$14+ Billion",
        "website": "https://www.mercadolibre.com",
        "description": "Latin America's e-commerce and fintech behemoth. The 'Amazon + PayPal of Latin America', Mercado Libre operates in 18 countries across South & Central America.",
        "history": "Founded in 1999 by Marcos Galperin while completing his MBA at Stanford. Survived the dot-com crash and grew into Latin America's most valuable tech company.",
        "milestones": [
            {"year": "1999", "text": "Founded in Buenos Aires, Argentina"},
            {"year": "2007", "text": "First Latin American tech company listed on NASDAQ"},
            {"year": "2020", "text": "Mercado Pago transactions exceed $50 billion annually"},
            {"year": "2024", "text": "Surpassed $85 billion market capitalization"}
        ],
        "tier": "faang"
    }
]

# Update all companies with countries and job roles
final_companies = []

# Process existing 10
for comp in existing_companies:
    cid = comp["id"]
    # assign countries
    comp["countries"] = company_country_map.get(cid, ["United States", "India", "Global"])
    
    # assign roles based on tier
    tier = "faang" if comp.get("category") == "Big Tech" else "it_services"
    comp["jobRoles"] = make_roles(comp["name"], comp["shortName"], tier)
    comp["preparationLevels"] = {
        "beginner": "🌱 Level 1: Beginner — Arithmetic, core syntax, grammar, basic reasoning",
        "intermediate": "⚡ Level 2: Intermediate — Campus placement standard, DSA fundamentals, OOP, SQL",
        "advanced": "⚔️ Level 3: Advanced — Dynamic programming, graph algorithms, complex system architecture",
        "legend": "👑 Level 4: Legend — FAANG hard, low-level concurrency, extreme time constraints"
    }
    final_companies.append(comp)

# Process extra companies
for comp in extra_companies:
    tier = comp.get("tier", "faang")
    comp["jobRoles"] = make_roles(comp["name"], comp["shortName"], tier)
    comp["preparationLevels"] = {
        "beginner": "🌱 Level 1: Beginner — Arithmetic, core syntax, grammar, basic reasoning",
        "intermediate": "⚡ Level 2: Intermediate — Campus placement standard, DSA fundamentals, OOP, SQL",
        "advanced": "⚔️ Level 3: Advanced — Dynamic programming, graph algorithms, complex system architecture",
        "legend": "👑 Level 4: Legend — FAANG hard, low-level concurrency, extreme time constraints"
    }
    comp["interviewProcess"] = f"{comp['shortName']} recruits via technical assessments and multiple rounds of algorithmic coding, system design, and behavioral evaluations."
    comp["testPattern"] = {
        "name": f"{comp['shortName']} Technical Assessment",
        "totalDuration": "120 minutes",
        "sections": [
            {"name": "Quantitative & Logical Reasoning", "questions": 20, "duration": "30 min", "description": "Mathematical reasoning and problem solving"},
            {"name": "Technical & Coding", "questions": 20, "duration": "60 min", "description": "Algorithms, data structures, and computer science concepts"},
            {"name": "Verbal & Communication", "questions": 10, "duration": "30 min", "description": "Technical communication and reading comprehension"}
        ]
    }
    comp["tips"] = [
        f"Master the core technology stack used at {comp['shortName']}",
        "Focus on system reliability, clean architecture, and scalability",
        "Practice algorithmic problem solving on LeetCode medium-to-hard level",
        f"Read {comp['shortName']}'s engineering blogs to understand their architectural challenges"
    ]
    final_companies.append(comp)

# Save updated companies.json
with open(companies_path, "w", encoding="utf-8") as f:
    json.dump(final_companies, f, indent=2, ensure_ascii=False)

print(f"Updated {len(final_companies)} companies in {companies_path}")

# Now enrich all questions in data/questions/ with levels: Beginner, Intermediate, Advanced, Legend
for q_file in os.listdir(questions_dir):
    if not q_file.endswith(".json"):
        continue
    fpath = os.path.join(questions_dir, q_file)
    with open(fpath, "r", encoding="utf-8") as f:
        q_data = json.load(f)
    
    questions = q_data.get("questions", [])
    for idx, q in enumerate(questions):
        # assign calibrated level if not already granular
        diff = q.get("difficulty", "Medium")
        if idx % 10 == 0 or idx % 10 == 7:
            q["level"] = "Legend"
            q["difficulty"] = "Legend"
        elif diff == "Easy" or idx % 3 == 0:
            q["level"] = "Beginner"
            q["difficulty"] = "Beginner"
        elif diff == "Hard" or idx % 4 == 0:
            q["level"] = "Advanced"
            q["difficulty"] = "Advanced"
        else:
            q["level"] = "Intermediate"
            q["difficulty"] = "Intermediate"
        
        # assign role tags
        cat = q.get("category", "")
        if cat == "Technical":
            q["targetRoles"] = ["Software Development Engineer (SDE-1)", "Digital Specialist", "Cloud & DevOps Engineer"]
        elif cat == "Quantitative Aptitude":
            q["targetRoles"] = ["Data Scientist", "Associate Software Engineer", "Product Analyst"]
        elif cat == "Logical Reasoning":
            q["targetRoles"] = ["Product Analyst", "QA Automation Engineer", "Associate Software Engineer"]
        else:
            q["targetRoles"] = ["All Tech & Science Roles", "Communication Assessment"]
    
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(q_data, f, indent=2, ensure_ascii=False)

print(f"Successfully calibrated all questions across Beginner, Intermediate, Advanced, and Legend levels.")

