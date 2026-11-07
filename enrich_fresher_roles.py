import json
import os

base_dir = r"C:\Users\ssree\.gemini\antigravity\scratch\prepwise"
companies_path = os.path.join(base_dir, "data", "companies.json")

with open(companies_path, "r", encoding="utf-8") as f:
    companies = json.load(f)

for comp in companies:
    cid = comp["id"]
    cname = comp["shortName"]
    is_big_tech = comp.get("category") == "Big Tech"

    # Create freshers specific job descriptions
    if is_big_tech:
        fresher_roles = [
            {
                "id": f"{cid}-fresher-sde",
                "title": f"Software Development Engineer I (2025/2026 College Graduate)",
                "avgSalary": "$145,000 - $175,000 / yr (US) · ₹22 - 36 LPA (India)",
                "salaryRange": "$140,000 - $190,000 / yr",
                "experience": "0 - 1 Years (Freshers & College Hires)",
                "fresherBatch": "2025 & 2026 Batch Passing Out",
                "fresherEligibility": "B.Tech / B.E. / M.Tech in CS, IT, ECE, EE or related STEM fields. Minimum 6.5 CGPA with zero active backlogs.",
                "level": "Intermediate to Advanced",
                "targetLevel": "Intermediate",
                "isFresherFocus": True,
                "ctcBreakdown": {
                    "basePay": "₹16 - 22 LPA ($130,000 - $145,000 Base)",
                    "signingBonus": "₹2 - 5 Lakhs (First Year Relocation & Sign-on)",
                    "stockGrant": "$40,000 - $60,000 RSUs vested over 4 years",
                    "benefits": "Free Health Insurance, Hybrid Work Allowance, Wellness Subsidies"
                },
                "jobDescription": f"As an entry-level SDE at {cname}, you will write high-quality, production-ready code for scalable distributed cloud systems. You will collaborate with senior staff engineers, participate in code reviews, design microservices, and deploy real features used by millions of global users daily.",
                "dayToDayDuties": [
                    "Design and implement efficient algorithms in C++, Java, Python, or Go",
                    "Write robust unit, integration, and performance test suites",
                    "Participate in sprint planning, architectural design discussions, and code reviews",
                    "Monitor production deployments, analyze error logs, and optimize database queries",
                    "Work with cross-functional product managers and designers to launch customer features"
                ],
                "keySkills": ["Data Structures & Algorithms", "Java / Python / C++", "Object-Oriented Design", "SQL Databases", "Git & CI/CD"],
                "prepRoadmap": [
                    "Month 1: Master Arrays, Two Pointers, Hash Maps, and Binary Search (Solve 75+ medium problems)",
                    "Month 2: Binary Trees, BSTs, Graph Traversals (BFS/DFS), and Heap priority queues",
                    "Month 3: Dynamic Programming patterns, String algorithms, and basic Object-Oriented Design",
                    "Month 4: Timed 45-minute mock interviews explaining Big-O time and space trade-offs out loud"
                ],
                "interviewRounds": [
                    "Round 1: Online Coding Screen (2 Algorithmic Problems, 70-90 min)",
                    "Round 2: Technical Phone Screen with Senior Engineer (Live DSA Coding)",
                    "Round 3: Onsite Problem Solving Round 1 (Trees, Graphs, Recursion)",
                    "Round 4: Onsite Problem Solving Round 2 (Algorithms & Data Structures)",
                    "Round 5: Behavioral & Cultural Fit Interview (Leadership Principles)"
                ],
                "targetCategory": "Technical"
            },
            {
                "id": f"{cid}-fresher-qa-devops",
                "title": f"Associate Cloud & Systems Engineer (Fresher Trainee)",
                "avgSalary": "$115,000 - $138,000 / yr (US) · ₹14 - 22 LPA (India)",
                "salaryRange": "$110,000 - $145,000 / yr",
                "experience": "0 Years (Fresher)",
                "fresherBatch": "2025 & 2026 Batch",
                "fresherEligibility": "Any Engineering or Science Degree (B.Tech, B.E, B.Sc, BCA, MCA). No strict cut-off if technical skills are demonstrated.",
                "level": "Beginner to Intermediate",
                "targetLevel": "Beginner",
                "isFresherFocus": True,
                "ctcBreakdown": {
                    "basePay": "₹12 - 16 LPA ($110,000 Base)",
                    "bonus": "₹1.5 - 2.5 LPA Annual Performance Variable",
                    "stockGrant": "$20,000 RSUs over 4 years"
                },
                "jobDescription": f"Support {cname}'s global cloud infrastructure and automated reliability pipelines. You will configure container environments, monitor service health, build observability dashboards, and automate deployment workflows.",
                "dayToDayDuties": [
                    "Automate infrastructure provisioning using Terraform and Docker containers",
                    "Monitor server latency, CPU utilization, and error rates using Datadog/Prometheus",
                    "Write automated test and build pipelines in GitHub Actions or Jenkins",
                    "Troubleshoot Linux OS network connections, DNS resolution, and SSL certificates",
                    "Participate in blameless post-mortem analysis for system anomalies"
                ],
                "keySkills": ["Linux Operating System", "Docker & Kubernetes Basics", "Python / Bash Scripting", "Computer Networking", "Cloud Fundamentals"],
                "prepRoadmap": [
                    "Week 1-2: Master Linux command line, process inspection, file permissions, and shell scripting",
                    "Week 3-4: Computer Networking fundamentals (TCP/IP, HTTP/HTTPS, DNS, Subnetting)",
                    "Week 5-6: Docker containerization and writing simple multi-stage Dockerfiles",
                    "Week 7-8: Practice infrastructure troubleshooting scenarios and basic coding questions"
                ],
                "interviewRounds": [
                    "Round 1: Cognitive Aptitude & Linux/Networking MCQs",
                    "Round 2: Practical Scripting & Debugging Assessment",
                    "Round 3: Systems Fundamentals & Problem Solving Interview",
                    "Round 4: HR & Cultural Alignment Round"
                ],
                "targetCategory": "Technical"
            }
        ]
    else: # IT Services & Consulting
        fresher_roles = [
            {
                "id": f"{cid}-fresher-ase",
                "title": f"Associate Software Engineer / Graduate Engineer Trainee (GET)",
                "avgSalary": "₹4.5 - 7.5 LPA (India) · $75,000 / yr (US)",
                "salaryRange": "₹4.0 - 8.5 LPA",
                "experience": "0 - 1 Years (Campus Recruits / Freshers)",
                "fresherBatch": "2024, 2025 & 2026 Batch Passing Out",
                "fresherEligibility": "B.E. / B.Tech / MCA / M.Sc (All branches eligible - CS, IT, ECE, EEE, Mechanical, Civil). Minimum 60% or 6.0 CGPA throughout 10th, 12th, and Degree.",
                "level": "Beginner",
                "targetLevel": "Beginner",
                "isFresherFocus": True,
                "ctcBreakdown": {
                    "basePay": "₹3.8 - 5.5 LPA Fixed",
                    "variablePay": "₹50,000 - ₹1,00,000 Performance Incentive",
                    "retentionBonus": "₹50,000 after 1 year of successful service",
                    "trainingAllowance": "Full stipend during 3-month foundation training academy"
                },
                "jobDescription": f"Start your professional software engineering career at {cname}. Freshers undergo an intensive 8-to-12 week training program covering full-stack development, cloud architecture, and modern agile practices before being deployed on global client enterprise projects.",
                "dayToDayDuties": [
                    "Undergo hands-on training in Java, .NET, Python, or Web Technologies",
                    "Develop, test, and maintain enterprise software modules and REST APIs",
                    "Write SQL queries, database stored procedures, and CRUD operations",
                    "Perform functional, unit, and regression testing on software builds",
                    "Collaborate with agile teams under senior project managers"
                ],
                "keySkills": ["Core Java / C++ / Python", "OOP Concepts", "Basic Data Structures", "SQL & Database Queries", "Quantitative Aptitude"],
                "prepRoadmap": [
                    "Week 1-3: Speed quantitative aptitude (percentages, ratios, work & time, numbers)",
                    "Week 4-5: Logical reasoning (coding-decoding, blood relations, series, syllogisms)",
                    "Week 6-7: Verbal ability and business English grammar rules",
                    "Week 8-10: C/Java/Python pseudo-code output prediction and fundamental coding problems",
                    "Week 11-12: Mock technical interviews covering college projects and core CS subjects"
                ],
                "interviewRounds": [
                    "Round 1: National Qualifier / Online Cognitive Test (Numerical, Reasoning, Verbal, Pseudo-code)",
                    "Round 2: Hands-on Programming Evaluation (1-2 fundamental coding problems)",
                    "Round 3: Technical Interview (Core Java/C++, DBMS, OS, and Final Year Project)",
                    "Round 4: HR & Managerial Interview (Communication skills, relocation willingness)"
                ],
                "targetCategory": "Quantitative Aptitude"
            },
            {
                "id": f"{cid}-fresher-specialist",
                "title": f"Digital Specialist Programmer / Ninja & Prime Track (High Package Fresher)",
                "avgSalary": "₹9.0 - 15.0 LPA (India) · $90,000 / yr (US)",
                "salaryRange": "₹8.5 - 16.5 LPA",
                "experience": "0 - 1 Years (Top Campus Coders)",
                "fresherBatch": "2025 & 2026 Batch",
                "fresherEligibility": "Open to all engineering students who clear the high-difficulty coding round in the national assessment. Zero backlog at time of joining.",
                "level": "Intermediate to Advanced",
                "targetLevel": "Advanced",
                "isFresherFocus": True,
                "ctcBreakdown": {
                    "basePay": "₹8.0 - 12.0 LPA Fixed",
                    "joiningBonus": "₹1.0 - 2.0 Lakhs",
                    "annualBonus": "₹1.0 - 1.5 Lakhs Variable based on project tier"
                },
                "jobDescription": f"Specialized high-package cadre at {cname} reserved for top 5% coding test performers. Recruits are directly assigned to high-impact digital transformation, AI/ML, cloud migration, and cybersecurity engineering labs.",
                "dayToDayDuties": [
                    "Architect microservices and high-throughput backend services",
                    "Implement machine learning inference pipelines and cloud integrations",
                    "Optimize database schemas, caching layers, and API response latencies",
                    "Build automated CI/CD pipelines and infrastructure-as-code scripts",
                    "Mentor junior developers and participate in technology innovation hackathons"
                ],
                "keySkills": ["Advanced Algorithms & DSA", "Full Stack (React/Node or Spring Boot)", "Microservices Architecture", "Cloud (AWS/Azure)", "Docker"],
                "prepRoadmap": [
                    "Phase 1: Dynamic programming, trees, and graph algorithms on LeetCode",
                    "Phase 2: Database normalization, indexing, transactions, and complex SQL joins",
                    "Phase 3: Building a full-stack production application with auth and database",
                    "Phase 4: Speed coding drills solving 2 hard algorithmic questions in under 60 minutes"
                ],
                "interviewRounds": [
                    "Round 1: Advanced Competitive Coding Challenge (3 Algorithmic Problems in 90 min)",
                    "Round 2: Deep-Dive Technical Interview (DSA + System Architecture + Live Coding)",
                    "Round 3: Specialized Technology & Project Defense Round",
                    "Round 4: Leadership & HR Fitment Round"
                ],
                "targetCategory": "Technical"
            },
            {
                "id": f"{cid}-fresher-qa-test",
                "title": f"Junior QA & Automation Test Engineer (Fresher Track)",
                "avgSalary": "₹4.8 - 7.0 LPA (India) · $78,000 / yr (US)",
                "salaryRange": "₹4.2 - 8.0 LPA",
                "experience": "0 Years (Fresher)",
                "fresherBatch": "2024, 2025 & 2026 Batch",
                "fresherEligibility": "B.Tech, B.E, B.Sc Computer Science, BCA, MCA with good analytical thinking.",
                "level": "Beginner to Intermediate",
                "targetLevel": "Beginner",
                "isFresherFocus": True,
                "ctcBreakdown": {
                    "basePay": "₹4.0 - 5.5 LPA Fixed",
                    "bonus": "₹50,000 - ₹80,000 Annual Variable",
                    "certificationBonus": "100% reimbursement for ISTQB, AWS, and Selenium certifications"
                },
                "jobDescription": f"Ensure bug-free, robust enterprise software releases at {cname}. You will learn automated testing frameworks, write Selenium/Playwright scripts, run API security tests, and report defect lifecycles.",
                "dayToDayDuties": [
                    "Analyze software requirements and design detailed test cases",
                    "Write automated test scripts in Java/Python using Selenium and TestNG",
                    "Execute API tests using Postman and validate JSON responses",
                    "Track software bugs in Jira and collaborate with developers on fixes",
                    "Run regression test suites before scheduled production deployments"
                ],
                "keySkills": ["Core Java / Python", "Software Testing Fundamentals", "Selenium / Playwright Basics", "SQL Queries", "Analytical Reasoning"],
                "prepRoadmap": [
                    "Week 1-2: Software Testing Life Cycle (STLC), black-box vs white-box, bug severity",
                    "Week 3-4: Core Java/Python OOP concepts (Inheritance, Polymorphism, Collections)",
                    "Week 5-6: Writing automated browser tests with Selenium and locators",
                    "Week 7-8: Practicing logical reasoning and SQL SELECT/JOIN queries"
                ],
                "interviewRounds": [
                    "Round 1: Aptitude & Logical Reasoning Online Assessment",
                    "Round 2: Programming Fundamentals & Bug Finding Test",
                    "Round 3: Technical Interview on Testing Concepts & SQL",
                    "Round 4: HR Discussion"
                ],
                "targetCategory": "Logical Reasoning"
            }
        ]

    # Combine existing non-duplicate roles with fresher roles first
    existing_roles = comp.get("jobRoles", [])
    comp["jobRoles"] = fresher_roles + [r for r in existing_roles if not r.get("isFresherFocus")]

with open(companies_path, "w", encoding="utf-8") as f:
    json.dump(companies, f, indent=2, ensure_ascii=False)

print(f"Successfully added rich Fresher Job Descriptions across all {len(companies)} companies.")

